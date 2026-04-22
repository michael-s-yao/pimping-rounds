/**
 * Loader and query helper for the `embeddings.json` file produced by the
 * `scripts/generate_embeddings.py` scripts.
 *
 * Author(s):
 *     Michael Yao @michael-s-yao
 *
 * Licensed under the MIT License. Copyright Michael Yao 2026.
 */

/**
 * Load the embeddings file and return a query API.
 * @param {string} url: Path or URL to embeddings.json
 * @returns {Promise<EmbeddingIndex>}
 */
export async function loadEmbeddings(url = "/embeddings.json", terms) {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to load ${url}: ${res.status}`);
  const { n, dim, embeddings: b64 } = await res.json();

  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const vecs = new Float32Array(raw.buffer);

  return new EmbeddingIndex(terms, vecs, n, dim);
}

class EmbeddingIndex {
  constructor(terms, vecs, n, dim) {
    this.terms = terms;
    this._vecs  = vecs;
    this.n = n;
    this.dim = dim;
  }

  getVec(i) {
    return this._vecs.subarray(i * this.dim, (i + 1) * this.dim);
  }

  getVecByTerm(term) {
    const i = this.terms.indexOf(term);
    if (i === -1)
      throw new Error(`Term not found: "${term}"`);
    return this.getVec(i);
  }

  dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++)
      s += a[i] * b[i];
    return s;
  }

  /**
   * Brute-force top-k nearest neighbours for a given query vector.
   * @param {Float32Array} queryVec: must have length === this.dim
   * @param {number} k: how many results to return.
   * @param {number | null} excludeIdx: an optional index to exclude
   *     (e.g. the index of the query itself).
   * @returns {{ term: string, index: number, score: number }[]}
   */
  topKVec(queryVec, k = 5, excludeIdx = null) {
    const scores = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      scores[i] = excludeIdx === i
        ? -Infinity
        : this.dot(queryVec, this.getVec(i));
    }

    const indices = Array.from({ length: this.n }, (_, i) => i)
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, k);

    return indices
      .map((i) => ({ term: this.terms[i], index: i, score: scores[i] }));
  }

  /**
   * Top-k by term string (exact match in the index).
   * @param {string} term
   * @param {number} k
   * @returns {{ term: string, index: number, score: number }[]}
   */
  topK(term, k = 5) {
    const i = this.terms.indexOf(term);
    if (i === -1)
      throw new Error(`Term not found: "${term}"`);
    return this.topKVec(this.getVec(i), k, i);
  }
}
