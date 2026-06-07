-- Entity images: tournament logo/banner, team logo, player photo.
-- Paths point into the public 'media' storage bucket.
alter table public.tournaments
  add column if not exists logo_path text,
  add column if not exists banner_path text;

alter table public.teams
  add column if not exists logo_path text;

alter table public.players
  add column if not exists photo_path text;

-- Public bucket for entity images. Uploads happen directly from the browser
-- (bypasses Vercel's request body limit); files are pre-resized webp images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Admins and organizers manage media. Uploads use unique filenames, so no
-- update policy is needed; replaced files are removed via the delete policy.
create policy "media_insert_staff"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role = 'organizer'
      )
    )
  );

create policy "media_delete_staff"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role = 'organizer'
      )
    )
  );
