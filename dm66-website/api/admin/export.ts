import { endpoint, HttpError } from '../../server/http.js';
import { requireAdmin } from '../../server/auth.js';
import { allLetters, exportCsv, sortOrder } from '../../server/letters.js';

export default endpoint('GET', async (request, response) => {
  await requireAdmin(request, response);
  const query = new URL(request.url || '/', 'http://localhost').searchParams;
  const format = query.get('format') || 'csv';
  if (format !== 'csv' && format !== 'json') throw new HttpError(400, 'Định dạng xuất không hợp lệ.');
  const letters = await allLetters(sortOrder(query.get('order')));
  response.setHeader('Content-Disposition', `attachment; filename="DM66_Loi_Nhan_20_10.${format}"`);
  response.setHeader('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8');
  response.statusCode = 200;
  response.end(format === 'csv' ? exportCsv(letters) : JSON.stringify(letters, null, 2));
});
