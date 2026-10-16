import { endpoint, json } from '../../server/http.js';
import { logout } from '../../server/auth.js';

export default endpoint('POST', async (request, response) => {
  await logout(request, response);
  json(response, 200, { authenticated: false });
});
