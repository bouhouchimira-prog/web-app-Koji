-- Enable the storage extension if not already enabled (usually enabled by default)
-- CREATE EXTENSION IF NOT EXISTS "storage";

-- 1. Create a public bucket named 'products'
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do NOTHING;

-- 2. Enable RLS on objects
alter table storage.objects enable row level security;

-- 3. Create Policies

-- Allow public read access to product images
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'products' );

-- Allow authenticated users to upload images
create policy "Authenticated users can upload images"
on storage.objects for insert
with check (
  bucket_id = 'products'
  and auth.role() = 'authenticated'
);

-- Allow authenticated users to update their images
create policy "Authenticated users can update images"
on storage.objects for update
using (
  bucket_id = 'products'
  and auth.role() = 'authenticated'
);

-- Allow authenticated users to delete images
create policy "Authenticated users can delete images"
on storage.objects for delete
using (
  bucket_id = 'products'
  and auth.role() = 'authenticated'
);
