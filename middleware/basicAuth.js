export function basicAuth(req, res, next) {
  const user = process.env.AUTH_USER;
  const pass = process.env.AUTH_PASS;
  if (!user || !pass) return next();

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Zonekeeper"');
    return res.status(401).send('Unauthorized');
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  const reqUser = decoded.slice(0, colon);
  const reqPass = decoded.slice(colon + 1);

  if (reqUser === user && reqPass === pass) return next();

  res.set('WWW-Authenticate', 'Basic realm="Zonekeeper"');
  res.status(401).send('Unauthorized');
}
