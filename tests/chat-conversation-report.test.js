import fs from 'fs';

const source = fs.readFileSync('src/pages/ChatPage.jsx', 'utf8');

if (!source.includes("import ReportModal from '../components/ReportModal';")) throw new Error('ChatPage must import ReportModal');
if (!source.includes('setIsReportOpen(true)')) throw new Error('ChatPage must expose a report action for the active conversation');
if (!source.includes('type="conversation"')) throw new Error('Conversation reports must use the conversation report type');

console.log('chat conversation report regression: PASS');
