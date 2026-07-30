function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "Items must be a non-empty array";
  }

  for (const item of items) {
    if (!item.equipmentId || !Number.isInteger(Number(item.equipmentId))) {
      return "Each item must have a valid equipmentId";
    }

    if (!item.quantity || Number(item.quantity) <= 0) {
      return "Each item must have a quantity greater than zero";
    }
  }

  return null;
}

function parseIdParam(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = {
  parseIdParam,
  validateItems,
};
