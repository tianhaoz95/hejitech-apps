-- Allow exercise demonstration GIFs in the FitLoop storage bucket.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/gif']
where id = 'fitloop';
