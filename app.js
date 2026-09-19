import { firebaseConfig } from './firebase-config.js';

const STORAGE_KEY = 'prisma-produtos';
let products = [];
let firestore = null;
let toastTimer;

const elements = {
  table: document.querySelector('#productsTableBody'), empty: document.querySelector('#emptyState'),
  search: document.querySelector('#searchInput'), category: document.querySelector('#categoryFilter'),
  total: document.querySelector('#totalProducts'), stock: document.querySelector('#totalStock'), value: document.querySelector('#stockValue'),
  results: document.querySelector('#resultsLabel'), dialog: document.querySelector('#productDialog'), form: document.querySelector('#productForm'),
  file: document.querySelector('#fileInput'), toast: document.querySelector('#toast'), error: document.querySelector('#formError'),
  connection: document.querySelector('#connectionLabel')
};

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = value => Number(value || 0).toLocaleString('pt-BR');
const configured = Object.values(firebaseConfig).every(Boolean);

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3500);
}

function saveLocal() { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }

async function setupFirestore() {
  if (!configured) return;
  try {
    const [{ initializeApp }, firestoreModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
    ]);
    const app = initializeApp(firebaseConfig);
    firestore = { ...firestoreModule, db: firestoreModule.getFirestore(app) };
    elements.connection.textContent = 'Firestore conectado';
    const snapshot = await firestore.getDocs(firestore.collection(firestore.db, 'produtos'));
    products = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    render();
  } catch (error) {
    console.error(error);
    elements.connection.textContent = 'Modo local (Firestore indisponível)';
    showToast('Não foi possível conectar ao Firestore.');
  }
}

async function persistProduct(product) {
  if (!firestore) { saveLocal(); return; }
  const { collection, doc, setDoc } = firestore;
  await setDoc(doc(collection(firestore.db, 'produtos'), product.id), product);
}

async function removeProduct(product) {
  if (firestore) await firestore.deleteDoc(firestore.doc(firestore.db, 'produtos', product.id));
  saveLocal();
}

function filteredProducts() {
  const query = elements.search.value.trim().toLowerCase();
  const category = elements.category.value;
  return products.filter(product => {
    const matchesQuery = !query || product.code.toLowerCase().includes(query) || product.description.toLowerCase().includes(query);
    return matchesQuery && (!category || product.category === category);
  });
}

function updateCategories() {
  const selected = elements.category.value;
  const categories = [...new Set(products.map(product => product.category))].sort((a, b) => a.localeCompare(b));
  elements.category.innerHTML = '<option value="">Todas as categorias</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  elements.category.value = categories.includes(selected) ? selected : '';
}

function render() {
  updateCategories();
  const visibleProducts = filteredProducts();
  elements.total.textContent = number(products.length);
  elements.stock.textContent = number(products.reduce((total, product) => total + product.quantity, 0));
  elements.value.textContent = money(products.reduce((total, product) => total + product.quantity * product.cost, 0));
  elements.results.textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
  elements.table.innerHTML = visibleProducts.map(product => `<tr>
    <td>${escapeHtml(product.code)}</td><td>${escapeHtml(product.description)}</td><td>${escapeHtml(product.category)}</td>
    <td>${number(product.quantity)}</td><td>${money(product.cost)}</td><td>${money(product.sale)}</td>
    <td class="actions-cell"><button class="action-button" data-edit="${product.id}" title="Editar produto">✎</button><button class="action-button delete" data-delete="${product.id}" title="Excluir produto">×</button></td>
  </tr>`).join('');
  elements.empty.classList.toggle('visible', visibleProducts.length === 0);
  elements.table.closest('table').style.display = visibleProducts.length ? '' : 'none';
}

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }

function openProductDialog(product = null) {
  elements.form.reset(); elements.error.textContent = '';
  document.querySelector('#dialogTitle').textContent = product ? 'Editar produto' : 'Novo produto';
  document.querySelector('#editingId').value = product?.id || '';
  if (product) {
    document.querySelector('#codeInput').value = product.code; document.querySelector('#descriptionInput').value = product.description;
    document.querySelector('#categoryInput').value = product.category; document.querySelector('#quantityInput').value = product.quantity;
    document.querySelector('#costInput').value = product.cost; document.querySelector('#saleInput').value = product.sale;
  }
  elements.dialog.showModal();
}

async function submitProduct(event) {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const id = document.querySelector('#editingId').value || crypto.randomUUID();
  const product = { id, code: formData.get('codeInput') || document.querySelector('#codeInput').value.trim(), description: document.querySelector('#descriptionInput').value.trim(), category: document.querySelector('#categoryInput').value.trim(), quantity: Number(document.querySelector('#quantityInput').value), cost: Number(document.querySelector('#costInput').value), sale: Number(document.querySelector('#saleInput').value) };
  if (!product.code || !product.description || !product.category) { elements.error.textContent = 'Preencha os campos obrigatórios.'; return; }
  const existingIndex = products.findIndex(item => item.id === id);
  if (existingIndex >= 0) products[existingIndex] = product; else products.unshift(product);
  try { await persistProduct(product); elements.dialog.close(); render(); showToast(existingIndex >= 0 ? 'Produto atualizado.' : 'Produto cadastrado.'); } catch (error) { console.error(error); showToast('Erro ao salvar o produto.'); }
}

function normalizeHeader(header) { return String(header || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function parseNumber(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '').trim().replace(/\./g, '').replace(',', '.');
  return Number(normalized) || 0;
}
function readImportedProduct(row, index) {
  const values = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  const get = (...keys) => keys.map(normalizeHeader).map(key => values[key]).find(value => value !== undefined && value !== '');
  return { id: crypto.randomUUID(), code: String(get('Código', 'Codigo') ?? '').trim(), description: String(get('Descrição', 'Descricao') ?? '').trim(), category: String(get('Categoria') ?? 'Sem categoria').trim(), quantity: parseNumber(get('Qtdade Disponível', 'Quantidade Disponivel', 'Qtdade')), cost: parseNumber(get('Custo Médio Unit.', 'Custo Medio Unit', 'Custo')), sale: parseNumber(get('ValorVenda', 'Valor Venda', 'Venda')), _row: index + 2 };
}

async function importFile(file) {
  if (!window.XLSX) { showToast('Leitor de planilhas não carregado.'); return; }
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
  const imported = rows.map(readImportedProduct).filter(product => product.code && product.description);
  if (!imported.length) { showToast('Nenhum produto válido foi encontrado.'); return; }
  try {
    for (const product of imported) { products.unshift(product); await persistProduct(product); }
    render(); showToast(`${imported.length} ${imported.length === 1 ? 'produto importado' : 'produtos importados'} com sucesso.`);
  } catch (error) { console.error(error); showToast('Erro ao importar os produtos.'); }
}

document.querySelector('#newProductButton').addEventListener('click', () => openProductDialog());
document.querySelector('#emptyAction').addEventListener('click', () => openProductDialog());
document.querySelector('#importButton').addEventListener('click', () => elements.file.click());
document.querySelector('#bannerImportButton').addEventListener('click', () => elements.file.click());
elements.file.addEventListener('change', event => { if (event.target.files[0]) importFile(event.target.files[0]); event.target.value = ''; });
elements.search.addEventListener('input', render); elements.category.addEventListener('change', render);
document.querySelector('#clearFiltersButton').addEventListener('click', () => { elements.search.value = ''; elements.category.value = ''; render(); });
elements.form.addEventListener('submit', submitProduct);
elements.table.addEventListener('click', async event => {
  const editId = event.target.dataset.edit; const deleteId = event.target.dataset.delete;
  if (editId) openProductDialog(products.find(product => product.id === editId));
  if (deleteId && confirm('Excluir este produto?')) { const product = products.find(item => item.id === deleteId); products = products.filter(item => item.id !== deleteId); try { await removeProduct(product); render(); showToast('Produto excluído.'); } catch (error) { showToast('Erro ao excluir o produto.'); } }
});

products = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
render();
setupFirestore();
