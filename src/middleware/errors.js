export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found.' });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = Number(err.status) || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Internal server error.' : (err.message || 'Request failed.')
  });
}
