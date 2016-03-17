# [Arquivo] EndjuGame

** Nota ** * Este repositório não está sob desenvolvimento ativo *.

EndjuGame é um jogo divertido tecnologia HTML5 [Ednju API] (https://endjubusiness.com). O jogo usa CSS 3 animações eo recorde é enviado através de autenticação Facebook e armazenados em Ednju API. Você pode conferir a versão ao vivo de [website (Esta em construção ainda ] o (https://www.msinga.ao/endjugame).

## Setup

### Configuração Web
1. Inscreva-se para [Ednju API] (http://api.endjubusiness.com/#signup) e criar uma nova Aplicação.
2. Cópia colar sua aplicação `` ID` e JavaScript key` na Parse.initialize função `` () no arquivo `index.html`.

`` `Js
Parse.initialize ( "APPLICATION_ID", "CLIENT_KEY");
`` `

Configuração ### Código Nuvem (Cloud Code)
1. Instale o [ferramenta de linha de comando Parse] (https://parse.com/docs/cloud_code_guide#started) usando `enrolar -s https://www.parse.com/downloads/cloud_code/installer.sh | sudo / bin / bash`
2. Execute o `parse new cloudCode` novo comando a partir do diretório raiz para inicializar o código de nuvem com suas chaves Endju APP (siga as instruções na tela).
3. Navegue até o diretório `` / cloudCode` usando cd cloudCode` e executar o `parse deploy` comando para implementar o Cloud Code.

### Configuração Facebook
1. Crie um novo [aplicativo do Facebook] (https://developers.facebook.com/apps) e sob as configurações do aplicativo, sob o cabeçalho Web Mobile, definir o sítio do Mobile URL para o seu servidor web localhost.
2. Atualize o Facebook App ID no `função Parse.FacebookUtils.init`.

`` `Js
Parse.FacebookUtils.init ({
    appId 'FACEBOOK_APP_ID'
    ...
`` `

### CSS e SASS

usos AnyYolk [Sass] (http://sass-lang.com/) e [Bússola] (http://compass-style.org/) para gerar itos CSS. Você vai encontrar o arquivo SCSS mão em `sass / screen.scss`. Para gerar o CSS a partir deste ficheiro, instale [Bússola] (http://compass-style.org/) e executar o `bússola watch` comando no diretório raiz.