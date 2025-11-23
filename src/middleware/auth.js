// API key auth middleware (enabled when process.env.API_KEY is set)
module.exports = function requireApiKeyFactory(expectedKey) {
  return function requireApiKey(req, res, next) {
    if (!expectedKey) return next();
    const header = req.get('x-api-key');
    if (header && header === expectedKey) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  };
};
