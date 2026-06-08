-- Tabla de certificados del Funding Manager
CREATE TABLE IF NOT EXISTS funding_certificates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  company     TEXT        NOT NULL,
  cert_type   TEXT        NOT NULL CHECK (cert_type IN ('cuenta_aprobada', 'retiro')),
  file_url    TEXT        NOT NULL,
  file_name   TEXT,
  amount      NUMERIC,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE funding_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own certificates"
  ON funding_certificates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket (público para lectura, autenticado para escritura)
INSERT INTO storage.buckets (id, name, public)
VALUES ('funding-certificates', 'funding-certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "auth upload funding certs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'funding-certificates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "public read funding certs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'funding-certificates');

CREATE POLICY "auth delete own funding certs"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'funding-certificates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
