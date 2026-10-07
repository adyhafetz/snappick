-- Align the scan retention column with the shared contract.
alter table public.scans rename column retention_until to retention_date;
