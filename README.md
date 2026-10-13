# Site Acadêmico — Alysson Machado

Site pessoal em Jekyll, baseado no [Academic Pages](https://academicpages.github.io/), com publicações, materiais e currículo. 

Endereço: [alyssonmach.github.io](https://alyssonmach.github.io).

## Execução Local

Pré-requisitos: Git, Ruby 3.2 e Bundler. Node.js 18 ou superior, Python 3.10 ou superior.

```sh
git clone https://github.com/Alyssonmach/alyssonmach.github.io.git
cd alyssonmach.github.io
gem install bundler
bundle config set --local path vendor/bundle
bundle install
bundle exec jekyll serve --livereload --host localhost
```

Abra `http://localhost:4000`. Alterações no conteúdo são recompiladas automaticamente. Após editar `_config.yml`, reinicie o servidor. Use `bundle exec` para executar a versão do Jekyll definida pelo projeto.

Alternativa com Docker:

```sh
docker compose up --build
```

## Atualizar o conteúdo

| Conteúdo | Arquivo ou pasta | O que editar |
| --- | --- | --- |
| Configuração geral | `_config.yml` | `title`, `description`, `url`, `baseurl`, `repository`, `locale` e `site_theme` |
| Perfil lateral | `_config.yml`, seção `author` | Nome, biografia, instituição, localização, e-mail e perfis acadêmicos e sociais |
| Foto do perfil | `images/profile.png` | Substitua a imagem ou altere `author.avatar` para outro arquivo em `images/` |
| Página inicial | `_pages/about.md` | Texto de apresentação e links |
| Menu | `_data/navigation.yml` | Títulos, destinos e ordem dos links |
| Publicações | `_publications/` | Um arquivo Markdown por trabalho |
| Categorias de publicações | `_data/publication_categories.yml` | Identificadores e títulos exibidos na listagem |
| Materiais do mestrado | `files/mestrado/` e `_data/mestrado.yml` | PDFs, grupos e metadados dos documentos |
| Currículo exibido no menu | `files/cv/cv.pdf` | Substitua o PDF mantendo o nome e o caminho |

`url` contém a origem do site, sem caminho; `baseurl` fica vazio para `usuario.github.io` ou recebe `/repositorio` quando o site usa um subdiretório. `repository` segue o formato `usuario/repositorio`. Em `author`, links acadêmicos recebem a URL completa; `github` e `linkedin` recebem o nome de usuário. Campos de perfil vazios não exibem links. `site_theme` aceita `default`, `air`, `sunrise`, `mint`, `dirt` ou `contrast`.

Os arquivos em `_pages/` definem título, endereço (`permalink`) e layout no bloco YAML entre `---`. Remover uma página do menu não impede sua publicação. As páginas e coleções herdadas do template continuam disponíveis pelos endereços atuais.

### Publicações

Crie um arquivo Markdown em `_publications/`, usando o título como nome, por exemplo `_publications/2026-titulo-do-trabalho.md`. O cadastro mínimo é:

```yaml
---
title: "Título do trabalho"
category: conferences
publication_year: 2026
sourceurl: "https://exemplo.org/publicacao"
---
```

O Jekyll preenche a coleção e o layout da página. O endereço é gerado a partir do nome do arquivo; use `permalink` apenas se precisar definir outro. Categorias atuais: `conferences`, `manuscripts`, `presentations`, `theses` e `internships`. Os identificadores, nomes exibidos e a ordem das categorias ficam em `_data/publication_categories.yml`. A listagem ordena os trabalhos dentro de cada categoria pelo ano, do mais recente para o mais antigo. O título abre o endereço em `sourceurl`. Esse campo aceita qualquer URL externa que você queira usar como link principal, como uma página do ResearchGate, do periódico, de um repositório ou de uma instituição. Use `"#"` enquanto não houver um link disponível.

Autores, veículo ou instituição e tipo são opcionais e aparecem na página individual quando informados. `date` é opcional; informe-o apenas quando a data completa for conhecida. O texto após o bloco YAML é conteúdo adicional da página individual.

### Materiais do mestrado

Adicione PDFs em `files/mestrado/`. Os grupos em `_data/mestrado.yml` usam `prefix` para selecionar arquivos: `bases-`, `revisao-`, `apresentações/` e `artigos/`. PDFs fora desses prefixos aparecem em "Outros materiais".

Para personalizar um documento, adicione uma entrada em `documents` usando o caminho completo, com acentos e espaços preservados:

```yaml
- path: "/files/mestrado/apresentações/Apresentação 2.pdf"
  title: "Apresentação 2"
  subtitle: "Subtítulo opcional"
  description: "Descrição breve do material."
  date: "2026-10-13"
```

Sem metadados, o título é derivado do nome do arquivo. Após adicionar, substituir ou remover PDFs, atualize as capas:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r scripts/preview-requirements.txt

python scripts/generate_mestrado_previews.py
```

Inclua `_data/mestrado_previews.json` e `images/mestrado/previews/` no mesmo commit dos PDFs. O script reaproveita capas válidas e remove apenas as miniaturas geradas sem uso. Sem capa, o documento continua acessível com um ícone de PDF. Adicionar arquivos pela interface do GitHub não executa esse script.

### Currículo

A página `/cv/` mostra `files/cv/cv.pdf` usando o leitor em `assets/cv-viewer.html`. Para atualizar o currículo, basta substituir esse PDF.

A página alternativa `/cv-json/`, herdada do template, usa `_data/cv.json` e é independente do currículo exibido no menu. Edite esse JSON diretamente se precisar manter essa página.

## Código e validação

- `_layouts/` e `_includes/`: estrutura HTML e componentes Liquid.
- `_sass/` e `assets/css/`: estilos; `assets/css/main.scss` define a ordem das importações.
- `assets/js/`: navegação entre páginas, leitor de CV e inicialização de gráficos e diagramas.
- `scripts/` e `tests/`: geração de capas e seus testes.

Após alterar `_main.js`, `theme.js` ou `plugins/jquery.greedy-navigation.js`, recompile o bundle e inclua o resultado no commit:

```sh
npm install
npm run build:js
```

`npm run watch:js` recompila durante a edição. `navigation.js`, `link-targets.js` e `cv-viewer.js` são carregados separadamente. Plotly e Mermaid são obtidos por CDN quando o conteúdo exige essas bibliotecas.

`assets/js/link-targets.js` faz links externos e PDFs abrirem em nova aba, inclusive após navegação entre páginas. Links internos e âncoras mantêm a navegação na aba do site. Essa regra é aplicada automaticamente aos links do conteúdo.

Antes de publicar:

```sh
bundle exec jekyll build --strict_front_matter
python3 -m unittest discover -s tests
```

Confira a página inicial, publicações, materiais e currículo no servidor local. `_site/`, `.venv/`, caches e dependências locais não devem ser versionados.

## Publicação e licença

Envie as alterações para a branch configurada no GitHub Pages e acompanhe a geração em **Actions**. Em **Settings → Pages**, mantenha a origem de publicação apontando para essa branch e a pasta raiz do repositório. Os PDFs, capas e o bundle JavaScript precisam estar versionados, pois não são gerados automaticamente pelo GitHub Pages.

Baseado no Academic Pages e no Minimal Mistakes, de Michael Rose. Licença MIT; veja [LICENSE](LICENSE).
