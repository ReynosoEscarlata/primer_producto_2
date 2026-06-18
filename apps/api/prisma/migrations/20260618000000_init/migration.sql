-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'NUTRITIONIST', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "birth_date" DATE,
    "height" DECIMAL(3,2),
    "weight" DECIMAL(5,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientNutritionist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "nutritionist_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientNutritionist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "water_ml" INTEGER NOT NULL,
    "exercise_minutes" INTEGER NOT NULL,
    "sleep_hours" DECIMAL(3,1) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoodEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "value" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_patient_date" ON "DailyLog"("patient_id", "date");

-- CreateIndex
CREATE INDEX "idx_mood_patient_occurred" ON "MoodEntry"("patient_id", "occurred_at");

-- CreateIndex
CREATE INDEX "idx_refresh_token_user" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_refresh_token_hash" ON "RefreshToken"("token_hash");

-- AddForeignKey
ALTER TABLE "PatientNutritionist" ADD CONSTRAINT "PatientNutritionist_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNutritionist" ADD CONSTRAINT "PatientNutritionist_nutritionist_id_fkey" FOREIGN KEY ("nutritionist_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyLog" ADD CONSTRAINT "DailyLog_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoodEntry" ADD CONSTRAINT "MoodEntry_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Lo siguiente no se puede expresar en schema.prisma (ver docs/db-diagram.dbml
-- para el detalle y el porqué de cada pieza) y se agrega a mano en esta migración.
-- ---------------------------------------------------------------------------

-- Un único nutricionista activo por paciente: PatientNutritionist es estructuralmente
-- N:N, pero la regla de negocio actual exige una sola relación activa (ended_at IS NULL)
-- por paciente a la vez.
CREATE UNIQUE INDEX "uniq_active_patient_per_nutritionist"
  ON "PatientNutritionist" ("patient_id")
  WHERE "ended_at" IS NULL;

-- Lista de pacientes activos de una nutrióloga sin escanear relaciones históricas.
CREATE INDEX "idx_active_patients_per_nutritionist"
  ON "PatientNutritionist" ("nutritionist_id")
  WHERE "ended_at" IS NULL;

-- height/weight son opcionales pero, si están presentes, tienen que ser positivos.
ALTER TABLE "User" ADD CONSTRAINT "chk_user_height_positive"
  CHECK ("height" IS NULL OR "height" > 0);

ALTER TABLE "User" ADD CONSTRAINT "chk_user_weight_positive"
  CHECK ("weight" IS NULL OR "weight" > 0);

-- Nunca puede existir más de un User con role = 'ADMIN' (el admin único se siembra
-- directo en la base de datos, no hay endpoint para crear otro).
CREATE UNIQUE INDEX "uniq_single_admin" ON "User" ("role") WHERE "role" = 'ADMIN';

-- patient_id en PatientNutritionist tiene que referenciar un User con role = 'PATIENT',
-- y nutritionist_id tiene que referenciar uno con role = 'NUTRITIONIST'. Una FK simple
-- solo valida que el id exista, no qué role tiene la fila referenciada.
CREATE OR REPLACE FUNCTION check_patient_nutritionist_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "User" WHERE id = NEW.patient_id AND role = 'PATIENT'
  ) THEN
    RAISE EXCEPTION 'patient_id % must reference a User with role PATIENT', NEW.patient_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "User" WHERE id = NEW.nutritionist_id AND role = 'NUTRITIONIST'
  ) THEN
    RAISE EXCEPTION 'nutritionist_id % must reference a User with role NUTRITIONIST', NEW.nutritionist_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_patient_nutritionist_roles
BEFORE INSERT OR UPDATE ON "PatientNutritionist"
FOR EACH ROW EXECUTE FUNCTION check_patient_nutritionist_roles();

-- Misma validación de rol para patient_id en DailyLog y MoodEntry: el id referenciado
-- tiene que ser un User con role = 'PATIENT'. Una sola función, reusada por ambos triggers.
CREATE OR REPLACE FUNCTION check_patient_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "User" WHERE id = NEW.patient_id AND role = 'PATIENT'
  ) THEN
    RAISE EXCEPTION 'patient_id % must reference a User with role PATIENT', NEW.patient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_daily_log_patient_role
BEFORE INSERT OR UPDATE ON "DailyLog"
FOR EACH ROW EXECUTE FUNCTION check_patient_role();

CREATE TRIGGER trg_check_mood_entry_patient_role
BEFORE INSERT OR UPDATE ON "MoodEntry"
FOR EACH ROW EXECUTE FUNCTION check_patient_role();
