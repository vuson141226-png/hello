import { endpoint, json } from '../../server/http.js';
import { requireAdmin } from '../../server/auth.js';
import { allLetters, sortOrder } from '../../server/letters.js';

export default endpoint('GET', async (request, response) => {
  await requireAdmin(request, response);
  const query = new URL(request.url || '/', 'http://localhost').searchParams;
  const letters = await allLetters(sortOrder(query.get('order')));
  json(response, 200, { letters, total: letters.length });
});
