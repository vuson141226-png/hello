import { endpoint, json } from '../../server/http.js';
import { requireAdmin } from '../../server/auth.js';

export default endpoint('GET', async (request, response) => {
  const admin = await requireAdmin(request, response);
  json(response, 200, { authenticated: true, email: admin.email });
});
