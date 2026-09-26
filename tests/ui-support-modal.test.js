import fs from 'node:fs';

const modal = fs.readFileSync('src/components/SupportModal.jsx', 'utf8');
const service = fs.readFileSync('src/services/cloudSyncService.js', 'utf8');
const worker = fs.readFileSync('_worker.js', 'utf8');
const migration = fs.readFileSync('db/migrations-production/0015_support_tickets.sql', 'utf8');

if (!modal.includes("cloudSyncService.submitSupportTicket")) throw new Error('Support modal must submit through the real API client');
if (modal.includes("setTimeout(")) throw new Error('Support modal must not fake delivery with a timeout');
if (!modal.includes('isSubmitting') || !modal.includes('role="alert"')) throw new Error('Support modal needs loading and error states');
if (!service.includes('/api/support/tickets') || !service.includes("credentials: 'include'")) throw new Error('Support API client must use authenticated session credentials');
if (!worker.includes("path === '/api/support/tickets'")) throw new Error('Worker support endpoint is missing');
if (!worker.includes('requireUser(request, env)')) throw new Error('Support endpoint must require authentication');
if (!worker.includes('INSERT INTO support_tickets')) throw new Error('Support endpoint must persist tickets');
if (!migration.includes('CREATE TABLE IF NOT EXISTS support_tickets')) throw new Error('Support tickets migration is missing');
console.log('support ticket production regression checks passed');

if (!worker.includes("PATCH") || !worker.includes("/api/admin/support/")) throw new Error('Admin support status endpoint is missing');
if (!worker.includes('requireAdmin(request, env)')) throw new Error('Admin support status update must require admin authorization');
if (!worker.includes("supportTickets")) throw new Error('Admin console must expose support tickets');
const admin = fs.readFileSync('src/pages/AdminDashboardRedesign.jsx', 'utf8');
if (!admin.includes('supportTickets') || !admin.includes('updateSupportStatus')) throw new Error('Admin UI must expose and update support tickets');
console.log('support admin regression checks passed');

const gateway = fs.readFileSync('worker-gateway2.js', 'utf8');
if (!gateway.includes("GET,POST,PATCH,OPTIONS")) throw new Error('Gateway CORS must allow PATCH requests');
console.log('gateway PATCH CORS regression check passed');
