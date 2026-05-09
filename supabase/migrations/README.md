# Supabase migrations — READ-ONLY MIRROR

This directory is a read-only mirror of `Ivy/supabase/migrations/`.

**Do not add migrations here.** Schema for the shared Supabase project is owned by the
`Ivy` repo. Add migrations there, apply via the Supabase CLI from there, then sync this
directory by `rsync -a /Users/moraybrown/Desktop/Ivy/supabase/migrations/ ./` from the
Ivy-Lab repo root.

Two migration sources for one Supabase project = drift. One source. Always.
