-- Removes ONLY the pilot (sample) data created by scripts/seed_pilot_data.sql.
-- Pilot users are the accounts with an email ending in @pilot.snappick.test. Deleting them cascades to their
-- profiles, scans, detections, pickups, items, ratings and disputes. Real users and their data are untouched.

begin;
delete from auth.users where email like '%@pilot.snappick.test';
commit;

select (select count(*) from auth.users where email like '%@pilot.snappick.test') as pilot_users_left,
       (select count(*) from auth.users) as total_users_left;
