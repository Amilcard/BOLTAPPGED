-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "stays" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description_short" TEXT NOT NULL,
    "programme" JSONB NOT NULL,
    "geography" TEXT NOT NULL,
    "accommodation" TEXT NOT NULL,
    "supervision" TEXT NOT NULL,
    "price_from" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "age_min" INTEGER NOT NULL,
    "age_max" INTEGER NOT NULL,
    "themes" JSONB NOT NULL,
    "image_cover" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "stay_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stay_id" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "seats_total" INTEGER NOT NULL,
    "seats_left" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stay_sessions_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "stays" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stay_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "social_worker_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "child_first_name" TEXT NOT NULL,
    "child_last_name" TEXT NOT NULL,
    "child_birth_date" DATETIME NOT NULL,
    "notes" TEXT,
    "child_notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookings_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "stays" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bookings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "stay_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stays_slug_key" ON "stays"("slug");

-- CreateIndex
CREATE INDEX "stays_slug_idx" ON "stays"("slug");

-- CreateIndex
CREATE INDEX "stays_published_idx" ON "stays"("published");

-- CreateIndex
CREATE INDEX "stays_period_idx" ON "stays"("period");
