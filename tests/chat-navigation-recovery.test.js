import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const chat = fs.readFileSync(new URL('../src/pages/ChatPage.jsx', import.meta.url), 'utf8');

test('ChatPage exposes a retryable recovery path for failed message loads and refreshes', () => {
  assert.match(chat, /const \[messageLoadError, setMessageLoadError\] = useState\(''\);/);
  assert.ok(chat.includes('setMessageLoadError(message);'));
  assert.ok(chat.includes('onClick={() => loadMessages(selectedId)}'));
  assert.ok(chat.includes("l('تلاش مجدد','Try again'"));
});

test('ChatPage does not silently discard polling failures', () => {
  assert.ok(chat.includes('.catch((e) => {'));
  assert.ok(chat.includes('setMessageLoadError(message);'));
  assert.doesNotMatch(chat, /fetchConversationMessages\(selectedId\)[\\s\\S]*?\.catch\(\(\) => \{\}\)/);
});

test('ChatPage renders the conversation report modal inside the returned tree', () => {
  const returnIndex = chat.indexOf('return <div');
  const reportIndex = chat.indexOf('<ReportModal');
  const functionEnd = chat.lastIndexOf('\n}');
  assert.ok(returnIndex >= 0);
  assert.ok(reportIndex > returnIndex);
  assert.ok(reportIndex < functionEnd);
  assert.match(chat, /\{selected && <ReportModal isOpen=\{isReportOpen\}/);
});


test('ChatPage exposes localized labels for mobile navigation and messaging controls', () => {
  assert.ok(chat.includes("aria-label={l('بازگشت به گفتگوها', 'Back to conversations', 'العودة إلى المحادثات', '返回会话列表')}"));
  assert.ok(chat.includes("aria-label={l('جستجوی گفتگوها', 'Search conversations', 'البحث في المحادثات', '搜索会话')}"));
  assert.ok(chat.includes("aria-label={l('نوشتن پیام', 'Write a message', 'كتابة رسالة', '输入消息')}"));
  assert.ok(chat.includes("aria-label={l('ارسال پیام', 'Send message', 'إرسال الرسالة', '发送消息')}"));
});
