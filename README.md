# Barvox Produtos

Sistema web estático para cadastrar, consultar e importar produtos.

## Como executar

1. Abra o arquivo `index.html` em um servidor local. Exemplo:

```powershell
python -m http.server 8000
```

2. Acesse `http://localhost:8000`.

Sem configuração do Firebase, os dados ficam salvos no `localStorage` do navegador para testes.

## Conectar ao Firestore

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Registre uma aplicação Web e copie o objeto de configuração.
3. Cole os valores no arquivo `firebase-config.js`.
4. No Firestore Database, crie o banco e configure as regras de segurança conforme o seu login/perfil de acesso.

A aplicação usará a coleção `produtos`, com os campos:

- `code`
- `description`
- `category`
- `quantity`
- `cost`
- `sale`

## Planilha

A primeira aba do arquivo `.xlsx`, `.xls` ou `.csv` deve conter os cabeçalhos:

`Código`, `Descrição`, `Categoria`, `Qtdade Disponível`, `Custo Médio Unit.`, `ValorVenda`

O importador também aceita versões sem acentos e variações como `Codigo`, `Descricao`, `Quantidade Disponivel`, `Custo` e `Valor Venda`.
