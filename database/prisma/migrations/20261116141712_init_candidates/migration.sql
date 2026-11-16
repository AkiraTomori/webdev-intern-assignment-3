-- CreateTable
CREATE TABLE "candidates" (
    "sbd" CHAR(8) NOT NULL,
    "toan" DECIMAL(4,2),
    "ngu_van" DECIMAL(4,2),
    "ngoai_ngu" DECIMAL(4,2),
    "vat_li" DECIMAL(4,2),
    "hoa_hoc" DECIMAL(4,2),
    "sinh_hoc" DECIMAL(4,2),
    "lich_su" DECIMAL(4,2),
    "dia_li" DECIMAL(4,2),
    "gdcd" DECIMAL(4,2),
    "ma_ngoai_ngu" VARCHAR(2),

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("sbd")
);

-- Hand-written: Prisma schema cannot express CHECK constraints.
-- NULL passes every CHECK below, so a blank score (NULL) is allowed while a real 0.00 is a valid score.

-- SBD is exactly 8 digits (leading zeros kept; GS-01-AC04, Q-03).
ALTER TABLE "candidates"
    ADD CONSTRAINT "candidates_sbd_format_chk" CHECK ("sbd" ~ '^[0-9]{8}$');

-- Every score is within 0..10 (0 is a legitimate score, hence >= 0).
ALTER TABLE "candidates"
    ADD CONSTRAINT "candidates_toan_range_chk"      CHECK ("toan"      >= 0 AND "toan"      <= 10),
    ADD CONSTRAINT "candidates_ngu_van_range_chk"   CHECK ("ngu_van"   >= 0 AND "ngu_van"   <= 10),
    ADD CONSTRAINT "candidates_ngoai_ngu_range_chk" CHECK ("ngoai_ngu" >= 0 AND "ngoai_ngu" <= 10),
    ADD CONSTRAINT "candidates_vat_li_range_chk"    CHECK ("vat_li"    >= 0 AND "vat_li"    <= 10),
    ADD CONSTRAINT "candidates_hoa_hoc_range_chk"   CHECK ("hoa_hoc"   >= 0 AND "hoa_hoc"   <= 10),
    ADD CONSTRAINT "candidates_sinh_hoc_range_chk"  CHECK ("sinh_hoc"  >= 0 AND "sinh_hoc"  <= 10),
    ADD CONSTRAINT "candidates_lich_su_range_chk"   CHECK ("lich_su"   >= 0 AND "lich_su"   <= 10),
    ADD CONSTRAINT "candidates_dia_li_range_chk"    CHECK ("dia_li"    >= 0 AND "dia_li"    <= 10),
    ADD CONSTRAINT "candidates_gdcd_range_chk"      CHECK ("gdcd"      >= 0 AND "gdcd"      <= 10);

-- The foreign-language exam code exists if and only if the foreign-language score exists.
-- The code values (N1..N7) are deliberately not listed: their meaning is unconfirmed (Q-04).
ALTER TABLE "candidates"
    ADD CONSTRAINT "candidates_ngoai_ngu_code_pair_chk"
    CHECK (("ngoai_ngu" IS NULL) = ("ma_ngoai_ngu" IS NULL));
