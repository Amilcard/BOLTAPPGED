-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_stays" (
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
    "updated_at" DATETIME NOT NULL,
    "departure_city" TEXT,
    "educational_option" TEXT,
    "source_url" TEXT,
    "source_pdf_path" TEXT,
    "imported_at" DATETIME,
    "last_sync_at" DATETIME,
    "source_manual" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_stays" ("accommodation", "age_max", "age_min", "created_at", "description_short", "duration_days", "geography", "id", "image_cover", "period", "price_from", "programme", "published", "slug", "supervision", "themes", "title", "updated_at") SELECT "accommodation", "age_max", "age_min", "created_at", "description_short", "duration_days", "geography", "id", "image_cover", "period", "price_from", "programme", "published", "slug", "supervision", "themes", "title", "updated_at" FROM "stays";
DROP TABLE "stays";
ALTER TABLE "new_stays" RENAME TO "stays";
CREATE UNIQUE INDEX "stays_slug_key" ON "stays"("slug");
CREATE INDEX "stays_slug_idx" ON "stays"("slug");
CREATE INDEX "stays_published_idx" ON "stays"("published");
CREATE INDEX "stays_period_idx" ON "stays"("period");
CREATE INDEX "stays_source_url_source_pdf_path_idx" ON "stays"("source_url", "source_pdf_path");
CREATE INDEX "stays_imported_at_idx" ON "stays"("imported_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
