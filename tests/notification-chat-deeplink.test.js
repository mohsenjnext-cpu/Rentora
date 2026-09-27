import fs from 'fs';
import path from 'path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const notifications = fs.readFileSync(path.join(root, 'src/pages/NotificationsPage.jsx'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'src/pages/ChatPage.jsx'), 'utf8');

if (!app.includes('chatInitialConversationId')) throw new Error('App must retain the notification chat target');
if (!app.includes('onOpenChat={(conversationId) => handleNavigate(\'chat\', { conversationId })}')) throw new Error('Notifications must navigate with conversation id');
if (!notifications.includes('onOpenChat(n.targetId)')) throw new Error('Notification click must pass conversation target');
if (!notifications.includes("add('message:' + (c.id || c.lastMessageAt), 'messages'")) throw new Error('Message notification must retain conversation id');
if (!chat.includes('initialConversationId')) throw new Error('ChatPage must accept an initial conversation id');
if (!chat.includes('setSelectedId(initialConversationId)')) throw new Error('ChatPage must select the notification target');
console.log('notification chat deep-link wiring assertions passed');
