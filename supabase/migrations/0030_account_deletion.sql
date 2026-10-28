-- 0030: deleting an account works again.
--
-- Deleting an account cascades: its conversations (for both people in
-- them, with every message, phone number and location shared there),
-- reviews, listings and the rest go with it. But messages.sender_id is
-- also ON DELETE SET NULL, and 0008's system_has_no_sender check required
-- every non-system message to keep a sender, so the SET NULL failed and
-- deleting anyone who had ever sent a message was refused. The check now
-- says only what it is for: system messages have no sender. New messages
-- still need one (the insert policy requires sender_id = auth.uid()).

alter table public.messages drop constraint system_has_no_sender;
alter table public.messages
  add constraint system_has_no_sender check (kind <> 'system' or sender_id is null);
