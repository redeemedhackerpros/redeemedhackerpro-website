# Customer case portal: secure setup plan

This repository is currently a static GitHub Pages site. A customer login and private case tracking need a trusted authentication/database service; a login page by itself is not security.

## Recommended foundation

Use Supabase Auth + Postgres Row Level Security (RLS) for customer sign-in and case data. Keep the existing public website working while the portal is built on a separate branch. The migration in `supabase/migrations/20261018000100_customer_cases.sql` is a starting database policy, not a deployed database.

### Planned customer experience

1. Customer signs up/signs in through Supabase Auth (enable email confirmation).
2. An authenticated customer submits a subject, category, and short description.
3. The database stores the case and automatically assigns its status as `new`.
4. The customer sees only cases whose `user_id` matches their authenticated account.
5. Authorized staff can see and update cases. A staff membership must be granted by a trusted administrator; users must never be allowed to grant themselves staff access.
6. Email notifications can be added through a trusted server-side function and a mail provider after the core workflow is tested.

## Setup steps (do not skip)

1. Create a Supabase project under the business owner's account.
2. In Authentication settings, enable email confirmation and configure the correct production site URL and redirect URLs. Use the real website origin; do not use wildcard redirects.
3. Review and apply the SQL migration in this repository in the new project's SQL editor. Do not run it against a production database without review and backup.
4. Create a test customer account. Confirm that it can create and read its own cases but cannot read another customer's case or change its status.
5. Add the staff member to `public.staff_members` only from the Supabase SQL editor or other trusted admin process after confirming the exact Auth user ID. Never expose service-role credentials in browser JavaScript.
6. Test that staff can update a case status/response, while ordinary customers cannot.
7. Configure rate limiting/spam protection and an email notification function before opening the portal to the public.
8. Add the browser-facing Supabase URL and publishable/anon key only after the project's RLS policies are reviewed. These are public browser configuration values, not a service-role secret. Do not commit private API keys or passwords.
9. Implement and test the frontend pages, then deploy only after review. This PR does not change the current live site.

## Important implementation notes

- The migration enables RLS and gives anonymous visitors no access to case records.
- Customers can read their own cases and insert a new case. They cannot set a status or staff response when creating it.
- Staff membership is held in a table with RLS enabled and no client-facing policies. Grant staff access only from a trusted administrative path.
- The `is_case_staff()` helper is a security-definer function with an empty search path and a narrow purpose. Review it with a database/security professional before production.
- The schema does not yet implement login UI, password reset UI, email delivery, spam controls, case attachments, audit logging, or staff notifications. Those are follow-up work, not features that should be assumed to exist.
- Do not ask customers to submit passwords, wallet seed phrases, private keys, authentication codes, or unrelated sensitive information in an enquiry.
- Customize `privacy.html` to describe the real provider, data collected, retention period, contact process, and applicable legal requirements before collecting real customer data.

## Before launch checklist

- [ ] Confirm project owner and billing/region requirements.
- [ ] Enable email confirmation and password reset.
- [ ] Confirm redirect URLs and HTTPS.
- [ ] Test RLS with two separate customer accounts and one staff account.
- [ ] Verify customer A cannot view customer B's case by changing an ID in the browser.
- [ ] Verify only staff can update status/response or view all cases.
- [ ] Add rate limiting, anti-spam controls, email delivery, and operational monitoring.
- [ ] Update the privacy notice and terms to match actual behavior.
- [ ] Review all changes before merging/deploying.
