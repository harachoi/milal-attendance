export function formatDateKorean(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

export function formatDateFile(iso: string): string {
  return iso.replace(/-/g, "");
}

export function formatCurrency(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "₩0";
  return `₩${n.toLocaleString("ko-KR")}`;
}
