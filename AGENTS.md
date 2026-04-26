# AGENTS

## Escopo Global

Este arquivo vale para o monorepo inteiro. Ele contem apenas regras compartilhadas e estaveis entre subprojetos.

- Mantenha neste nivel apenas orientacoes gerais de navegação, arquitetura e fluxo de trabalho.
- Nao coloque aqui detalhes de implementacao, comandos ou convencoes especificas de um subprojeto.
- Quando existir um `AGENTS.md` dentro de um subprojeto, ele tem prioridade sobre este arquivo para aquele escopo.

## Visao Geral

StreamTube e uma plataforma de compartilhamento de videos. Usuarios anonimos podem assistir livremente; funcionalidades sociais e de gerenciamento dependem de autenticacao.

Mais contexto funcional em [docs/project-plan.md](docs/project-plan.md).

## Estrutura do Monorepo

- [nestjs-project/](nestjs-project/) — backend API em NestJS e area atualmente ativa.
- [docs/](docs/) — documentacao de produto, arquitetura e planejamento.
- Futuras areas do monorepo devem receber instrucoes locais proprias em vez de ampliar este arquivo.

## Arquitetura

Consulte [docs/diagrams/software-arch.mermaid](docs/diagrams/software-arch.mermaid) para o diagrama completo.

- Frontend (futuro) chama a API via REST e consome streaming do armazenamento de objetos.
- API concentra regras de negocio, autenticacao, acesso ao banco, upload, fila e envio de e-mails.
- Worker de video processa jobs em segundo plano e atualiza banco e armazenamento.
- Banco, armazenamento de objetos, fila e servico de e-mail sao dependencias compartilhadas entre subprojetos.

## Docker e Conectividade

- Quando houver containers, use o nome do service do Docker Compose como host entre servicos.
- Nao use `localhost` ou `127.0.0.1` para trafego entre containers.
- Se um subprojeto expuser variaveis de ambiente, elas devem seguir essa regra de rede.

## Diretrizes Compartilhadas

- Antes de alterar qualquer area, procure primeiro o `AGENTS.md` mais proxmo ao codigo que voce vai tocar.
- Prefira links para documentacao existente em vez de repetir contexto em instrucoes de agente.
- Se uma mudanca atravessar mais de um subprojeto, preserve as regras locais de cada um e registre apenas o criterio global aqui.
- Atualize [docs/](docs/) quando a mudanca afetar produto, arquitetura ou contratos entre subprojetos.

## Principios Gerais

- Estruture alteracoes com responsabilidade unica quando isso fizer sentido para o dominio.
- Mantenha a tipagem consistente com TypeScript e preserve a qualidade de codigo entre subprojetos.
- Sempre que houver comportamento novo, valide com os testes e checks apropriados do subprojeto afetado.
- Use ESLint e Prettier como referencias de consistencia de estilo quando estiverem presentes no subprojeto.

## Git Convencoes

- Trate `main` como branch estavel e evite commits diretos nela.
- Prefira branches curtas e descritivas para feature, bugfix, hotfix ou docs.
- Commits devem ser curtos e focados no motivo da mudanca.

## O Que Evitar Aqui

- Comandos de build, teste e execucao de subprojetos.
- Regras de lint, tipagem e formato que valem apenas para uma stack especifica.
- Detalhes de pasta, nome de modulo, fluxo HTTP ou infraestrutura que pertencem a um subprojeto.
