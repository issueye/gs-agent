export function ok(res, data) {
  return res.json({ data: data });
}

export function created(res, data) {
  return res.status(201).json({ data: data });
}

export function fail(res, status, code, message) {
  return res.status(status).json({
    error: {
      code: code,
      message: message,
    },
  });
}

export function page(items, query) {
  let pageNumber = Number((query || {}).page || 1);
  let pageSize = Number((query || {}).page_size || (query || {}).pageSize || 20);
  if (pageNumber <= 0) {
    pageNumber = 1;
  }
  if (pageSize <= 0) {
    pageSize = 20;
  }
  if (pageSize > 200) {
    pageSize = 200;
  }
  let total = items.length;
  let start = (pageNumber - 1) * pageSize;
  if (start > total) {
    start = total;
  }
  let end = start + pageSize;
  if (end > total) {
    end = total;
  }
  return {
    items: items.slice(start, end),
    total: total,
    page: pageNumber,
    page_size: pageSize,
  };
}
