# Destaque diário Apple Podcasts

A página consulta o resumo público `/api/rankings/latest.json` do Observatório, que combina as posições do arquivo GitHub com as recolhas manuais verificadas. As consultas agendadas continuam às 06h00, 13h00 e 20h00 em Europe/Lisbon. O botão privado «Nova recolha» consulta diretamente a Apple e disponibiliza os resultados no mesmo resumo. Cada visitante consulta esse pequeno resumo, sem pedir listas à Apple e sem guardar classificações no navegador.

O destaque «As melhores posições do dia» apresenta a bandeira e a melhor posição do dia por país e categoria (Livros, Arte, Top Geral de Programas), em qualquer posição registada nas três categorias, com fonte Apple e classificação comprovada sem divergência. As bandeiras são imagens PNG servidas pelo próprio Observatório, disponíveis para todos os países e regiões monitorizados. Um novo país com classificação recebe automaticamente a respetiva bandeira. A data é sempre a de Lisboa. Até à recolha seguinte, o último dia confirmado continua visível com o título «Últimos registos na Apple Podcasts» e a data real. Uma nova recolha sem resultados elegíveis oculta o destaque; não se recuperam classificações de dias anteriores. Se houver uma falha temporária de ligação, conserva-se apenas o resultado já confirmado na página, com a sua data. A página volta a consultar o resumo de cinco em cinco minutos, quando regressa ao primeiro plano e quando recupera a ligação.

No ecrã principal da app instalada, há um destaque de classificações e uma entrada permanente «Observatório do Podcast». Os dados online não entram na cache offline da app.

Testes: `node --test apple-top10.test.mjs`.

Os ficheiros `apple-top10.js` e `apple-top10.css` são iguais nas duas páginas. Ao alterá-los, atualizar a versão nos respetivos URLs e, na app, a versão da cache de `sw.js`. No site dos episódios, o gerador copia os ficheiros para `public/assets` e inclui o destaque só na página inicial, preservando-o nas atualizações do RSS.
