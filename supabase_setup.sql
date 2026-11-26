-- ============================================================================
-- ملف إعداد قاعدة البيانات والحماية لموقع «المكتبة» (Supabase SQL)
-- ----------------------------------------------------------------------------
-- طريقة التشغيل:
-- 1) افتح مشروعك في Supabase -> اختر SQL Editor من القائمة اليسرى
-- 2) اضغط New Query -> انسخ هذا الملف بالكامل والصقه هناك
-- 3) اضغط Run (يمكن إعادة تشغيله بأمان دون أخطاء)
-- ============================================================================

-- 1) جدول ملفات المستخدمين (profiles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text unique not null,
  contact_email text,
  grade text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- 2) جدول الكتب (books)
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null default '',
  category text not null check (category in ('study', 'general', 'religious')),
  grade text not null default 'عام للجميع',
  description text not null default '',
  drive_url text not null,
  cover_url text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3) دالة آمنة للتحقق هل المستخدم الحالي هو المالك (admin)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- 4) Trigger تلقائي لإنشاء سجل في جدول profiles فور تسجيل أي مستخدم جديد
-- ملاحظة: يتم منح صلاحية المالك (admin) تلقائياً لرقم هاتف المالك 01011439841 فقط
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_role text;
begin
  v_phone := coalesce(new.raw_user_meta_data->>'phone', '');

  if v_phone = '01011439841' then
    v_role := 'admin';
  else
    v_role := 'user';
  end if;

  insert into public.profiles (
    id,
    first_name,
    last_name,
    phone,
    contact_email,
    grade,
    role
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'first_name'), ''), 'مستخدم'),
    coalesce(nullif(trim(new.raw_user_meta_data->>'last_name'), ''), 'جديد'),
    v_phone,
    nullif(trim(coalesce(new.raw_user_meta_data->>'contact_email', '')), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'grade'), ''), 'خريج / قارئ عام'),
    v_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5) تفعيل الحماية على مستوى الصفوف (Row Level Security)
alter table public.profiles enable row level security;
alter table public.books enable row level security;

-- سياسات جدول profiles:
-- المستخدم يرى ملفه الشخصي فقط، والمالك يرى جميع المستخدمين المسجلين
drop policy if exists "Users can read own profile or admin reads all" on public.profiles;
create policy "Users can read own profile or admin reads all"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

-- سياسات جدول books:
-- أي مستخدم مسجّل دخول يمكنه قراءة جميع الكتب
drop policy if exists "Authenticated users can view books" on public.books;
create policy "Authenticated users can view books"
  on public.books
  for select
  using (auth.role() = 'authenticated');

-- فقط المالك (admin) يمكنه إضافة كتب جديدة
drop policy if exists "Only admin can insert books" on public.books;
create policy "Only admin can insert books"
  on public.books
  for insert
  with check (public.is_admin());

-- فقط المالك (admin) يمكنه تعديل الكتب
drop policy if exists "Only admin can update books" on public.books;
create policy "Only admin can update books"
  on public.books
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- فقط المالك (admin) يمكنه حذف الكتب
drop policy if exists "Only admin can delete books" on public.books;
create policy "Only admin can delete books"
  on public.books
  for delete
  using (public.is_admin());

-- 6) فهارس لتحسين سرعة البحث والفلترة
create index if not exists idx_books_category on public.books (category);
create index if not exists idx_books_grade on public.books (grade);
create index if not exists idx_books_created_at on public.books (created_at desc);
