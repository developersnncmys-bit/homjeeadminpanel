// Shared ordering for Deep Cleaning packages so the Create-Lead modal lists
// them in the SAME order as the Deep Cleaning products section (category →
// subcategory → service, per the master catalog) instead of by price (#8).
import { DEEP_CLEANING_DATA } from "../pages/DeepCleaningDashboard";

const categoryIndex = new Map();
const subcategoryIndex = new Map();
const serviceIndex = new Map();

DEEP_CLEANING_DATA.forEach((catObj, cIdx) => {
  categoryIndex.set(catObj.category, cIdx);
  (catObj.subcategories || []).forEach((subObj, sIdx) => {
    subcategoryIndex.set(`${catObj.category}__${subObj.subcategory}`, sIdx);
    (subObj.services || []).forEach((sv, vIdx) => {
      serviceIndex.set(`${catObj.category}__${subObj.subcategory}__${sv}`, vIdx);
    });
  });
});

const BIG = 999999;
const getCatIdx = (cat) =>
  categoryIndex.has(cat) ? categoryIndex.get(cat) : BIG;
const getSubIdx = (cat, sub) =>
  subcategoryIndex.has(`${cat}__${sub}`)
    ? subcategoryIndex.get(`${cat}__${sub}`)
    : BIG;
const getSvIdx = (cat, sub, sv) => {
  if (!sv) return -1;
  const key = `${cat}__${sub}__${sv}`;
  return serviceIndex.has(key) ? serviceIndex.get(key) : BIG;
};

// Sort a list of package objects ({category, subcategory, service, name}) into
// catalog order — identical to DeepCleaningDashboard's sortedPackages.
export const sortPackagesByCatalog = (pkgs = []) =>
  [...pkgs].sort((a, b) => {
    const c1 = getCatIdx(a.category);
    const c2 = getCatIdx(b.category);
    if (c1 !== c2) return c1 - c2;

    const s1 = getSubIdx(a.category, a.subcategory);
    const s2 = getSubIdx(b.category, b.subcategory);
    if (s1 !== s2) return s1 - s2;

    const v1 = getSvIdx(a.category, a.subcategory, a.service);
    const v2 = getSvIdx(b.category, b.subcategory, b.service);
    if (v1 !== v2) return v1 - v2;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
