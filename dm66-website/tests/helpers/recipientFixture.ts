import type { Page } from '@playwright/test'

// Entirely synthetic browser fixtures. These are not shipped in the application.
export const profiles = Array.from({ length: 5 }, (_, index) => ({
  id: `fixture-0${index + 1}`,
  fullName: `Người nhận thử ${index + 1}`,
  displayName: `Bạn mẫu ${index + 1}`,
  image: `/test-portraits/recipient-0${index + 1}.svg`,
  introduction: 'Hồ sơ chỉ dùng cho kiểm thử.',
  personality: '',
  wish: `Lời chúc kiểm thử số ${index + 1}.`,
  width: [853, 1381, 1276, 1627, 853][index],
}))
export const testStudentCode = 'TEST-ONLY-01'
export function fixtureRecipient(index = 0) {
  const { wish, width: _width, ...recipient } = profiles[index]
  return {
    ...recipient,
    studentCode: testStudentCode,
    wishes: [
      { id: `wish-${index}-1`, title: 'Một ngày thật vui', senderName: 'DM66D Boys', message: wish },
      { id: `wish-${index}-2`, title: 'Gửi một nụ cười', senderName: 'Bạn gửi mẫu', message: `Một lời chúc khác cho bạn mẫu ${index + 1}.` },
    ],
  }
}
export async function mockRecipients(page: Page) {
  await page.route('**/test-portraits/*.svg', route => {
    const profile = profiles.find(item => route.request().url().endsWith(item.image)) ?? profiles[0]
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${profile.width}" height="1400"><rect width="100%" height="100%" fill="#29222b"/><circle cx="420" cy="430" r="180" fill="#f3b9c8"/></svg>` })
  })
  await page.route('**/data/recipient-wishes.json', route => route.fulfill({ json: profiles.map((_, index) => fixtureRecipient(index)) }))
}
