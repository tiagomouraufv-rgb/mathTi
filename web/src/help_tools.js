/* MathTi — ajuda de cada ferramenta (botão direito do mouse ou toque longo sobre o botão)
   Cada entrada: [o que faz, entradas (como declarar), exemplo (linhas da folha)] */
'use strict';
(function () {
  const FC = window.FC;
  const H = {
    /* ---------- Matemática ---------- */
    '≔': ['Define uma variável ou uma função. A tecla “:” já escreve “:=”.', 'À esquerda o nome (ou nome(argumentos) para uma função); à direita a expressão. Só pode ser usado depois de definido (a folha é lida de cima para baixo e da esquerda para a direita).', 'a := 2\nf(x) := a·x^2\nf(3) ='],
    '=': ['Avalia a expressão e mostra o valor.', 'Termine a linha com “=”. Também vale depois de uma definição (a := 2 =).', 'a := 3\na^2 + 1 ='],
    '→': ['Mostra o resultado simbólico (expandido), substituindo as funções definidas antes.', 'Termine a linha com “->”.', 'f(x) := 3·x\ng(x, y) := f(x)·y\ng(x, y) ->'],
    'a, b ‥ c': ['Variável de intervalo, como no Mathcad: uma lista de valores de início a fim.', 'nome := início, segundo valor .. fim. O segundo valor define o passo; sem ele, o passo é 1.', 'x := 0, 0.5 .. 2\nx^2 ='],
    '//': ['Comentário: a linha não é calculada e aparece em itálico.', 'Comece a linha com //.', '// constantes do laser\nλ_L := 1064 nm'],
    'x²': ['Eleva ao quadrado.', 'Escreva depois do valor ou entre parênteses.', '(1 + 2)^2 ='],
    'xʸ': ['Potência.', 'base ^ expoente; use parênteses em expoentes compostos.', '2^(1/2) ='],
    '√': ['Raiz quadrada (de número negativo dá complexo).', 'sqrt(valor)', 'sqrt(2) =\nsqrt(-4) ='],
    '|x|': ['Valor absoluto (módulo de complexo, norma de vetor).', 'abs(valor)', 'abs(-3) =\nabs(3 + 4i) ='],
    '·': ['Multiplicação (também “*”).', 'a · b', '2·π ='],
    '÷': ['Divisão.', 'a / b', '1/3 ='],
    'i': ['Unidade imaginária.', 'Escreva junto do número (4i) ou use i sozinho; não redefina i se for usar complexos.', 'z := 3 + 4i\nabs(z) ='],
    'π': ['Número π.', 'π ou pi', '2·π ='],
    'e': ['Número de Euler.', 'e (também exp(1))', 'e ='],
    '∞': ['Infinito (para limites de integrais, por exemplo).', '∞ ou Infinity', 'integral(exp(-x), x, 0, ∞) ='],
    integral: ['Integral definida numérica.', 'integral(expressão, variável, a, b). A variável de integração vale só dentro da integral; a e b podem ser ∞.', 'integral(x^2, x, 0, 1) ='],
    'Σ': ['Somatório.', 'Σ(k, início, fim, expressão); k é inteiro e vale só dentro do somatório.', 'Σ(k, 1, 10, k^2) ='],
    'Π': ['Produtório.', 'Π(k, início, fim, expressão)', 'Π(k, 1, 5, k) ='],
    diff: ['Derivada simbólica.', 'diff(expressão, variável) -> (termine com “->”).', 'diff(x^3 + sin(x), x) ->'],
    deriv: ['Derivada numérica num ponto.', 'deriv(expressão, variável, ponto)', 'deriv(sin(x), x, 0) ='],
    root: ['Raiz de uma equação f(x) = 0 entre dois pontos (a função muda de sinal entre eles).', 'root(expressão, variável, a, b)', 'root(x^2 - 2, x, 0, 2) ='],
    if: ['Condicional numa linha.', 'if(condição, valor se verdadeiro, valor se falso); condições com <, >, ==, ≠, and, or.', 'deg(x) := if(x > 0, 1, 0)\ndeg(-2) ='],
    expandir: ['Expande produtos e potências de polinômios.', 'expandir(expressão) -> (termine com “->”).', 'expandir((x + 1)^2) ->'],

    /* ---------- Programação ---------- */
    'prog … end': ['Bloco de programa com valor: as linhas recuadas são executadas em ordem e a última linha é o resultado.', 'nome := prog, as instruções recuadas 2 espaços e end na última linha. Variáveis locais com ←.', 'S := prog\n  s ← 0\n  for k ∈ 1 .. 10\n    s ← s + k\n  s\nend\nS ='],
    'f(x) := prog': ['Programa como função: recebe argumentos e devolve a última linha (ou o valor de return).', 'f(argumentos) := prog … end', 'fat(n) := prog\n  p ← 1\n  for k ∈ 1 .. n\n    p ← p·k\n  p\nend\nfat(5) ='],
    '←': ['Atribuição local dentro de um programa (não altera a folha).', 'nome ← valor (também <-).', 'r := prog\n  a ← 2\n  a^2\nend\nr ='],
    'v[i] ←': ['Atribui um elemento de vetor ou matriz dentro do programa; o vetor cresce sozinho (posições vazias valem 0).', 'v[i] ← valor ou M[i, j] ← valor; índices começam em 0.', 'v := prog\n  for i ∈ 0 .. 4\n    v[i] ← i^2\n  v\nend\nv ='],
    for: ['Laço sobre um intervalo ou um vetor.', 'for i ∈ início .. fim (ou i ∈ início, segundo .. fim, ou i ∈ vetor) e as linhas recuadas abaixo.', 's := prog\n  t ← 0\n  for i ∈ 0, 2 .. 10\n    t ← t + i\n  t\nend\ns ='],
    while: ['Repete enquanto a condição for verdadeira.', 'while condição e as linhas recuadas abaixo; cuide para a condição mudar.', 'n := prog\n  k ← 0\n  while 2^k < 1000\n    k ← k + 1\n  k\nend\nn ='],
    'if ': ['Executa as linhas recuadas só se a condição for verdadeira (dentro de programas).', 'if condição, linhas recuadas; depois, opcionalmente, else if / else.', 'sinal(x) := prog\n  if x > 0\n    return 1\n  else if x < 0\n    return -1\n  else\n    0\nend\nsinal(-3) ='],
    'else if': ['Outra condição testada quando a anterior falha.', 'else if condição, no mesmo recuo do if.', 'c(x) := prog\n  if x < 0\n    return 0\n  else if x < 1\n    return x\n  else\n    1\nend\nc(0.5) ='],
    else: ['Executa quando nenhuma condição anterior foi verdadeira.', 'else, no mesmo recuo do if.', 'm(x) := prog\n  if x > 0\n    x\n  else\n    -x\nend\nm(-2) ='],
    break: ['Sai do laço for/while.', 'break dentro do laço.', 'p := prog\n  r ← 0\n  for k ∈ 1 .. 100\n    if k^2 > 50\n      break\n    r ← k\n  r\nend\np ='],
    continue: ['Pula para a próxima volta do laço.', 'continue dentro do laço.', 's := prog\n  t ← 0\n  for k ∈ 1 .. 10\n    if mod(k, 2) == 0\n      continue\n    t ← t + k\n  t\nend\ns ='],
    return: ['Encerra o programa devolvendo um valor.', 'return valor', 'f(x) := prog\n  if x < 0\n    return 0\n  sqrt(x)\nend\nf(4) ='],
    try: ['Tenta executar; se der erro, executa o bloco on error.', 'try, linhas recuadas, on error, linhas recuadas.', 'r := prog\n  try\n    v ← [1, 2]\n    v[5]\n  on error\n    -1\nend\nr ='],
    Given: ['Bloco de solução (solve block): restrições e depois find ou minerr.', 'Dê valores iniciais às incógnitas, escreva Given, as restrições recuadas (com =, <, >) e depois sol := find(incógnitas).', 'u := 1\nv := 1\nGiven\n  u^2 + v^2 = 4\n  u - v = 1\nsol := find(u, v) ='],
    find: ['Resolve as restrições do bloco Given (Levenberg–Marquardt).', 'find(incógnitas) logo depois do bloco Given; devolve um vetor.', 'x := 1\nGiven\n  x^3 = 8\nr := find(x) ='],
    minerr: ['Como find, mas devolve a melhor aproximação (mínimos quadrados) mesmo sem solução exata.', 'minerr(incógnitas) depois do bloco Given.', 'x := 1\nGiven\n  x = 2\n  x = 3\nr := minerr(x) ='],
    rkfixed: ['Resolve EDOs por Runge–Kutta de 4ª ordem com passo fixo.', 'rkfixed(y0, x inicial, x final, número de passos, D); D(x, y) devolve o vetor das derivadas; y0 é vetor coluna. Saída: matriz [x, y0, y1, …].', 'D(t, y) := [-y[0]]\nY := rkfixed([1], 0, 1, 10, D)\nY[10, 1] ='],
    Rkadapt: ['Resolve EDOs com passo adaptativo (Dormand–Prince); bom para sistemas rígidos ou rápidos.', 'Rkadapt(y0, x inicial, x final, número de pontos da saída, D)', 'D(t, y) := [-10·y[0]]\nY := Rkadapt([1], 0, 1, 20, D)\nY[20, 1] ='],
    'D(t, y)': ['Modelo de função de derivadas para rkfixed e Rkadapt.', 'D(t, y) := [expressão para dy0/dt; expressão para dy1/dt; …]; y[0], y[1] são as componentes.', 'k := 2\nD(t, y) := [-k·y[0]; k·y[0] - y[1]]\nD(0, [1, 0]) ='],
    polyroots: ['Raízes de um polinômio.', 'polyroots(v) com v = [v0, v1, v2, …] para v0 + v1·x + v2·x² + … (ordem do Mathcad).', 'polyroots([-6, 11, -6, 1]) ='],
    minimize: ['Ponto de mínimo de uma função num intervalo.', 'minimize(expressão, variável, a, b)', 'minimize((x - 1)^2 + 3, x, -5, 5) ='],
    maximize: ['Ponto de máximo de uma função num intervalo.', 'maximize(expressão, variável, a, b)', 'maximize(x·exp(-x), x, 0, 5) ='],

    /* ---------- Matriz ---------- */
    '2×2': ['Escreve uma matriz 2×2.', '[a, b; c, d]: vírgula separa colunas, ponto e vírgula separa linhas.', 'M := [1, 2; 3, 4]\nM ='],
    '3×1': ['Escreve um vetor coluna.', '[a; b; c]', 'v := [1; 2; 3]\nv ='],
    zeros: ['Matriz de zeros.', 'zeros(linhas, colunas)', 'zeros(2, 3) ='],
    identity: ['Matriz identidade.', 'identity(n)', 'identity(3) ='],
    linspace: ['Vetor de n valores igualmente espaçados.', 'linspace(início, fim, n)', 'linspace(0, 1, 5) ='],
    'v[i] ≔': ['Define um vetor elemento a elemento com uma variável de intervalo.', 'i := 0 .. n e depois v[i] := expressão em i.', 'i := 0 .. 4\nv[i] := i^2\nv ='],
    'Mᵢ,ⱼ': ['Elemento de vetor ou matriz.', 'M[i, j] ou v[i]; índices começam em 0.', 'M := [1, 2; 3, 4]\nM[1, 0] ='],
    transpose: ['Transposta.', 'transpose(M)', 'transpose([1, 2; 3, 4]) ='],
    inv: ['Inversa de uma matriz quadrada.', 'inv(M)', 'inv([2, 0; 0, 4]) ='],
    det: ['Determinante.', 'det(M)', 'det([1, 2; 3, 4]) ='],
    cross: ['Produto vetorial (vetores de 3 componentes).', 'cross(a, b)', 'cross([1, 0, 0], [0, 1, 0]) ='],
    dot: ['Produto escalar.', 'dot(a, b)', 'dot([1, 2, 3], [4, 5, 6]) ='],
    eigs: ['Autovalores (e autovetores) de uma matriz.', 'eigs(M).values para os autovalores.', 'eigs([2, 0; 0, 3]).values ='],
    augment: ['Junta matrizes lado a lado (colunas).', 'augment(A, B, …); o mesmo número de linhas.', 'augment([1; 2], [3; 4]) ='],
    stack: ['Empilha matrizes (linhas).', 'stack(A, B, …); o mesmo número de colunas.', 'stack([1, 2], [3, 4]) ='],
    col: ['Uma coluna de uma matriz.', 'col(M, j); j começa em 0.', 'col([1, 2; 3, 4], 1) ='],
    row: ['Uma linha de uma matriz.', 'row(M, i); i começa em 0.', 'row([1, 2; 3, 4], 0) ='],
    rows: ['Número de linhas.', 'rows(M)', 'rows([1, 2; 3, 4; 5, 6]) ='],
    cols: ['Número de colunas.', 'cols(M)', 'cols([1, 2; 3, 4; 5, 6]) ='],

    /* ---------- Funções ---------- */
    Jn: ['Função de Bessel de primeira espécie Jₙ(x).', 'Jn(n, x); n inteiro.', 'Jn(0, 2.4048) ='],
    Yn: ['Função de Bessel de segunda espécie Yₙ(x).', 'Yn(n, x); x > 0.', 'Yn(0, 1) ='],
    In: ['Bessel modificada de primeira espécie Iₙ(x).', 'In(n, x)', 'In(0, 1) ='],
    Kn: ['Bessel modificada de segunda espécie Kₙ(x).', 'Kn(n, x); x > 0.', 'Kn(0, 1) ='],
    js: ['Bessel esférica jₙ(x) (espalhamento Mie).', 'js(n, x)', 'js(0, 1) ='],
    ys: ['Bessel esférica de segunda espécie yₙ(x).', 'ys(n, x); x > 0.', 'ys(0, 1) ='],
    Her: ['Polinômio de Hermite Hₙ(x) (físico), dos modos Hermite–Gauss.', 'Her(n, x)', 'Her(2, 1) ='],
    Lag: ['Polinômio de Laguerre Lₙ(x).', 'Lag(n, x)', 'Lag(2, 1) ='],
    LagA: ['Laguerre associado Lₙ^α(x), dos modos Laguerre–Gauss.', 'LagA(n, α, x)', 'LagA(1, 2, 0.5) ='],
    Leg: ['Polinômio de Legendre Pₙ(x).', 'Leg(n, x); −1 ≤ x ≤ 1.', 'Leg(2, 0.5) ='],
    Cheb: ['Polinômio de Chebyshev Tₙ(x).', 'Cheb(n, x)', 'Cheb(3, 0.5) ='],
    gamma: ['Função gama Γ(x) (Γ(n) = (n − 1)!).', 'gamma(x)', 'gamma(5) ='],
    erf: ['Função erro.', 'erf(x)', 'erf(1) ='],
    erfc: ['Função erro complementar 1 − erf(x).', 'erfc(x)', 'erfc(1) ='],
    sinc: ['sinc(x) = sin(x)/x (com sinc(0) = 1).', 'sinc(x), x em radianos.', 'sinc(π/2) ='],
    sin: ['Seno (radianos; aceita graus com a unidade deg).', 'sin(x)', 'sin(π/6) =\nsin(30 deg) ='],
    cos: ['Cosseno.', 'cos(x)', 'cos(π) ='], tan: ['Tangente.', 'tan(x)', 'tan(π/4) ='],
    asin: ['Arco seno (resultado em radianos).', 'asin(x), −1 ≤ x ≤ 1.', 'asin(1) ='], acos: ['Arco cosseno.', 'acos(x)', 'acos(0) ='], atan: ['Arco tangente.', 'atan(x)', 'atan(1) ='],
    atan2: ['Ângulo do ponto (x, y), entre −π e π.', 'atan2(y, x) — atenção à ordem: y primeiro.', 'atan2(1, -1) ='],
    sinh: ['Seno hiperbólico.', 'sinh(x)', 'sinh(1) ='], cosh: ['Cosseno hiperbólico.', 'cosh(x)', 'cosh(1) ='], tanh: ['Tangente hiperbólica.', 'tanh(x)', 'tanh(1) ='],
    exp: ['Exponencial eˣ.', 'exp(x)', 'exp(1) ='],
    ln: ['Logaritmo natural.', 'ln(x)', 'ln(e^2) ='],
    log: ['Logaritmo na base 10 (como no Mathcad); com dois argumentos, na base dada.', 'log(x) ou log(x, base)', 'log(1000) =\nlog(8, 2) ='],
    mean: ['Média.', 'mean(vetor) ou mean(a, b, …)', 'mean([1, 2, 3, 4]) ='],
    median: ['Mediana.', 'median(vetor)', 'median([3, 1, 2]) ='],
    stdev: ['Desvio padrão populacional (divide por n).', 'stdev(vetor)', 'stdev([2, 4, 4, 4, 5, 5, 7, 9]) ='],
    Stdev: ['Desvio padrão amostral (divide por n − 1).', 'Stdev(vetor)', 'Stdev([2, 4, 4, 4, 5, 5, 7, 9]) ='],
    max: ['Maior valor.', 'max(vetor) ou max(a, b, …)', 'max([3, 7, 2]) ='], min: ['Menor valor.', 'min(vetor)', 'min([3, 7, 2]) ='], sum: ['Soma dos elementos.', 'sum(vetor)', 'sum([1, 2, 3]) ='],
    linterp: ['Interpolação linear em dados tabelados.', 'linterp(vx, vy, x); vx crescente.', 'linterp([0, 1, 2], [0, 10, 40], 1.5) ='],
    spline: ['Interpolação por spline cúbica natural.', 'spline(vx, vy, x)', 'spline([0, 1, 2, 3], [0, 1, 4, 9], 1.5) ='],
    pchip: ['Interpolação PCHIP (cúbica que preserva a forma: sem oscilações entre os pontos).', 'pchip(vx, vy, x); vx crescente. Avisa quando x sai dos dados (extrapolação).', 'pchip([0, 1, 2, 3], [0, 1, 0, 1], 1.5) ='],
    akima: ['Interpolação de Akima (suave e robusta a pontos isolados).', 'akima(vx, vy, x); pelo menos 5 pontos é o ideal.', 'akima([0, 1, 2, 3, 4], [0, 1, 0, 1, 0], 1.5) ='],
    interp2D: ['Interpolação 2D numa tabela x, y, z em grade (como o Pg do tabelaXYZ).', 'interp2D(T, x, y); T é a matriz de 3 colunas.', 'g(x, y) := x + 10·y\nT := tabelaXYZ(g, 0, 1, 4, 0, 1, 3)\ninterp2D(T, 2.5, 1.5) ='],
    tabelar: ['Calcula uma função uma vez numa grade e passa a usar a interpolação (acelera funções lentas, como integrais). Só recalcula se algo acima mudar; a tabela fica salva no arquivo.', 'f_t := tabelar(f, a, b, n); f é uma função de um argumento; a e b são os limites; n o número de pontos.', 'lento(x) := integral(exp(-t^2)·cos(x·t), t, 0, 5)\nlento_t := tabelar(lento, 0, 10, 401)\nlento_t(2.5) ='],
    tabelaXYZ: ['Tabela x, y, g(x, y) com x no laço externo (o seu Pg do Mathcad), pronta para virar matriz no Origin.', 'tabelaXYZ(g, x0, dx, x1, y0, dy, y1); g é uma função de dois argumentos.', 'g(x, y) := x·y\nPg := tabelaXYZ(g, 0, 1, 2, 0, 1, 1)\nPg ='],

    /* ---------- Unidades e constantes ---------- */
    c: ['Velocidade da luz no vácuo, 299 792 458 m/s.', 'Use c direto (não redefina c se for usar a constante).', 'λ := 532 nm\nν := c/λ\nν to THz ='],
    h: ['Constante de Planck, 6,626 × 10⁻³⁴ J·s.', 'h', 'E := h·c/(532 nm)\nE to eV ='],
    'ħ': ['Constante de Planck reduzida h/2π.', 'ħ', 'ħ ='],
    k_B: ['Constante de Boltzmann, 1,380649 × 10⁻²³ J/K.', 'k_B', 'k_B·295 K to J ='],
    ε_0: ['Permissividade do vácuo.', 'ε_0', 'ε_0 ='], μ_0: ['Permeabilidade do vácuo.', 'μ_0', 'μ_0 ='],
    q_e: ['Carga elementar.', 'q_e', 'q_e ='], m_e: ['Massa do elétron.', 'm_e', 'm_e ='], N_A: ['Número de Avogadro.', 'N_A', 'N_A ='],
    'em eV': ['Converte o resultado para a unidade pedida.', 'expressão to unidade = (precisa ser uma grandeza compatível).', 'E := h·c/(500 nm)\nE to eV ='],
    'em nm': ['Mostra o valor em nanômetros.', 'expressão to nm =', '0.532 µm to nm ='], 'em µm': ['Mostra o valor em micrômetros.', 'expressão to um =', '1064 nm to um ='],

    /* ---------- Óptica ---------- */
    zR: ['Comprimento de Rayleigh de um feixe gaussiano, π w0² n/λ.', 'zR(w0, λ, n); n é opcional (1). Com unidades, sai em metros.', 'zR(0.5 µm, 1064 nm, 1.33) ='],
    wz: ['Raio do feixe gaussiano a uma distância z da cintura.', 'wz(z, w0, λ, n)', 'wz(1 µm, 0.5 µm, 1064 nm, 1.33) ='],
    Rz: ['Raio de curvatura da frente de onda.', 'Rz(z, w0, λ, n); infinito em z = 0.', 'Rz(2 µm, 0.5 µm, 1064 nm, 1) ='],
    gouy: ['Fase de Gouy arctan(z/zR).', 'gouy(z, w0, λ, n)', 'gouy(1, 1, 3.14159, 1) ='],
    Egauss: ['Campo complexo do feixe gaussiano (E = 1 no centro da cintura).', 'Egauss(ρ, z, w0, λ, n); distâncias na mesma unidade.', 'abs(Egauss(0.5, 0, 1, 0.5, 1)) ='],
    Igauss: ['Intensidade normalizada |E|² do feixe gaussiano.', 'Igauss(ρ, z, w0, λ, n)', 'Igauss(0, 0, 1, 0.5, 1) ='],
    Ifeixe: ['Intensidade absoluta de um feixe gaussiano de potência P: 2P/(πw²)·exp(−2ρ²/w²).', 'Ifeixe(ρ, z, w0, λ, P, n); com unidades sai em W/m².', 'Ifeixe(0, 0, 0.5 µm, 1064 nm, 10 mW, 1.33) ='],
    LG: ['Modo Laguerre–Gauss normalizado (vórtice de carga l).', 'LG(p, l, ρ, φ, z, w0, λ, n); p ≥ 0, l inteiro.', 'abs(LG(0, 1, 0.7, 0, 0, 1, 0.8))^2 ='],
    HG: ['Modo Hermite–Gauss normalizado.', 'HG(m, n, x, y, z, w0, λ, nr)', 'abs(HG(1, 0, 0.5, 0, 0, 1, 0.8))^2 ='],
    besselBeam: ['Feixe de Bessel ideal J_l(k sinθ ρ) e^{ilφ} e^{ik cosθ z}.', 'besselBeam(l, ρ, φ, z, θ_cone, λ, n)', 'abs(besselBeam(0, 0, 0, 0, 0.1, 1, 1)) ='],
    campo: ['Amostra uma função f(x, y) numa grade N×N de lado L (campo para óptica de Fourier).', 'campo(f, L, N); f é uma função de dois argumentos; x_j = (j − N/2)·L/N.', 'ab(x, y) := circ(x, y, 0.3)\nU0 := campo(ab, 2, 64)\nrows(U0) ='],
    grade: ['Coordenadas da grade usada por campo.', 'grade(L, N)', 'grade(1, 4) ='],
    fft2c: ['Transformada de Fourier 2D centrada.', 'fft2c(U), U matriz.', 'f1(x, y) := exp(-(x^2 + y^2))\nF := fft2c(campo(f1, 8, 16))\nmax(abs(F)) ='],
    ifft2c: ['Transformada inversa 2D centrada.', 'ifft2c(U)', 'f1(x, y) := exp(-(x^2 + y^2))\nU := campo(f1, 4, 16)\nmax(abs(ifft2c(fft2c(U)) - U)) ='],
    propEA: ['Propaga um campo pelo espectro angular (exato, com ondas evanescentes).', 'propEA(U, L, λ, z, n); mesma unidade para L, λ e z.', 'f1(x, y) := exp(-(x^2 + y^2))\nU := campo(f1, 40, 128)\nIz := intensidade(propEA(U, 40, 0.5, 6.28, 1))\nmax(Iz) ='],
    fresnel: ['Propagação de Fresnel (paraxial) pela função de transferência.', 'fresnel(U, L, λ, z, n)', 'ab(x, y) := circ(x, y, 0.3)\nU := campo(ab, 2, 128)\nI := intensidade(fresnel(U, 2, 633·10^-6, 100, 1))\nmax(I) ='],
    fraunhofer: ['Campo distante (Fraunhofer); a janela de saída tem lado fraunL(L, λ, z, N, n).', 'fraunhofer(U, L, λ, z, n)', 'ab(x, y) := circ(x, y, 0.5)\nU := campo(ab, 16, 128)\nfraunL(16, 0.001, 10000, 128, 1) ='],
    fraunL: ['Lado da janela de saída da transformação de Fraunhofer, λzN/L.', 'fraunL(L, λ, z, N, n)', 'fraunL(16, 0.001, 10000, 128, 1) ='],
    lente: ['Aplica a fase de uma lente fina de distância focal f.', 'lente(U, L, λ, f, n)', 'f1(x, y) := 1\nU := lente(campo(f1, 1, 8), 1, 0.5, 100, 1)\nrows(U) ='],
    intensidade: ['|U|² elemento a elemento (para mostrar num mapa de calor).', 'intensidade(U)', 'intensidade([1 + i, 2]) ='],
    fase: ['Fase arg(U) elemento a elemento.', 'fase(U)', 'fase([i, -1]) ='],
    amostra: ['Valor do campo num ponto (interpolação bilinear).', 'amostra(U, L, x, y)', 'f1(x, y) := x + y\nU := campo(f1, 2, 32)\namostra(U, 2, 0.25, 0.25) ='],
    circ: ['Abertura circular: 1 dentro do círculo de raio R, 0 fora.', 'circ(x, y, R)', 'circ(0.1, 0.1, 0.5) ='],
    rect: ['Fenda: 1 se |x| ≤ a/2, 0 fora.', 'rect(x, a)', 'rect(0.2, 1) ='],
    jones: ['Vetor de Jones de uma polarização padrão.', 'jones("H"), "V", "D", "A", "+" (circular com S₃ = +1) ou "-".', 'jones("+") ='],
    polarizador: ['Matriz de Jones de um polarizador linear no ângulo θ.', 'polarizador(θ), θ em radianos.', 'stokes(polarizador(π/4)·jones("H")) ='],
    lamina: ['Matriz de Jones de um retardador Γ com eixo rápido em θ (λ/4: Γ = π/2; λ/2: Γ = π).', 'lamina(Γ, θ)', 'stokes(lamina(π/2, π/4)·jones("H")) ='],
    rotacao: ['Matriz de rotação 2×2.', 'rotacao(θ)', 'rotacao(π/2) ='],
    stokes: ['Parâmetros de Stokes [S0; S1; S2; S3] de um vetor de Jones.', 'stokes(J)', 'stokes(jones("D")) ='],
    elipse: ['Orientação ψ e elipticidade χ da polarização.', 'elipse(J) = [ψ; χ] em radianos.', 'elipse(jones("+")) ='],
    CM: ['Fator de Clausius–Mossotti (εp − εm)/(εp + 2εm).', 'CM(εp, εm); permissividades relativas (n²).', 'CM(1.59^2, 1.33^2) ='],
    alfaCM: ['Polarizabilidade de uma esfera pequena (regime de Rayleigh), 4πε0 εm a³ CM.', 'alfaCM(a, εp, εm); a é o raio; com unidades sai em F·m².', 'alfaCM(25 nm, 1.59^2, 1.33^2) ='],
    alfaRad: ['Polarizabilidade com correção radiativa.', 'alfaRad(α, λ, εm)', 'α1 := alfaCM(25 nm, 1.59^2, 1.33^2)\nalfaRad(α1, 1064 nm, 1.33^2) ='],
    sigmaScat: ['Seção de choque de espalhamento k⁴|α|²/(6π ε0² εm²).', 'sigmaScat(α, λ, εm)', 'α1 := alfaCM(25 nm, 1.59^2, 1.33^2)\nsigmaScat(α1, 1064 nm, 1.33^2) ='],
    sigmaAbs: ['Seção de choque de absorção k Im(α)/(ε0 εm).', 'sigmaAbs(α, λ, εm); só não é zero com εp complexo.', 'α2 := alfaCM(25 nm, 2.5 + 0.1i, 1.33^2)\nsigmaAbs(α2, 1064 nm, 1.33^2) ='],
    Fgrad: ['Força de gradiente Re(α) ∇I /(2 c n_m ε0).', 'Fgrad(α, ∂I/∂x, n_m)', 'α1 := alfaCM(25 nm, 1.59^2, 1.33^2)\nFgrad(α1, 1e15 W/m^3, 1.33) ='],
    Fscat: ['Força de espalhamento n_m (σesp + σabs) I / c.', 'Fscat(α, I, λ, n_m)', 'α1 := alfaCM(25 nm, 1.59^2, 1.33^2)\nFscat(α1, 1e10 W/m^2, 1064 nm, 1.33) ='],
    Uarm: ['Energia potencial da armadilha −Re(α) I /(2 c n_m ε0).', 'Uarm(α, I, n_m); divida por k_B·T para ter em k_BT.', 'α1 := alfaCM(25 nm, 1.59^2, 1.33^2)\nI0 := Ifeixe(0, 0, 0.5 µm, 1064 nm, 100 mW, 1.33)\nUarm(α1, I0, 1.33)/(k_B·295 K) ='],
    RW_I: ['Intensidade no foco de uma objetiva (Richards–Wolf, integral vetorial de Debye), normalizada ao pico do foco com polarização x.', 'RW_I(x, y, z, NA, n, λ, f0, pol, l): distâncias e λ na mesma unidade; f0 = fator de preenchimento (1e9 = uniforme); pol = "x", "y", "circ+", "circ-", "radial" ou "azimutal"; l = carga do vórtice.', 'RW_I(0.3, 0, 0, 1.2, 1.33, 1.064, 1, "x", 0) ='],
    RW_campo: ['Campo vetorial [Ex; Ey; Ez] no foco (Richards–Wolf).', 'RW_campo(x, y, z, NA, n, λ, f0, pol, l)', 'RW_campo(0, 0, 0, 1.2, 1.33, 1.064, 1, "radial", 0) ='],
    RWi_I: ['Intensidade no foco através de uma interface plana (lamínula n1 → água n2), com aberração esférica.', 'RWi_I(x, y, z, NA, n1, n2, λ, d, f0, pol, l); d = profundidade nominal; z medido a partir da interface.', 'RWi_I(0, 0, 17.5, 0.3, 1.515, 1.33, 1.064, 20, 1e9, "x", 0) ='],
    RWi_campo: ['Campo vetorial no foco através de interface.', 'RWi_campo(x, y, z, NA, n1, n2, λ, d, f0, pol, l)', 'RWi_campo(0, 0, 17.5, 0.3, 1.515, 1.33, 1.064, 20, 1e9, "x", 0) ='],

    /* ---------- Botões grandes ---------- */
    'btn:Gráfico XY': ['Cria um gráfico de curvas y(x). Em “Editar”: expressões das curvas, intervalo de x, cores, espessura, escala log, rótulos e estilo de revista.', 'Defina antes as funções; no gráfico escreva, por exemplo, f(x) e g(x, 2), e a variável x com mínimo e máximo (ou use uma variável de intervalo).', 'f(x) := x^2'],
    'btn:Mapa de calor': ['Cria um mapa de calor z = g(x, y) ou mostra uma matriz (por exemplo intensidade(U)).', 'Em “Editar”: a expressão, as variáveis x e y com intervalos e número de pontos, a paleta, curvas de nível e marcação de mínimos.', 'g(x, y) := sin(x)·cos(y)'],
    'btn:Superfície 3D': ['Cria uma superfície 3D z = g(x, y).', 'Em “Editar”: expressão, intervalos de x e y, número de pontos e paleta.', 'g(x, y) := exp(-(x^2 + y^2))'],
    'btn:Controle deslizante': ['Cria uma variável com um controle deslizante; ao arrastar, a folha recalcula na hora.', 'Em “Editar”: nome (ex.: λ_OT), mínimo, máximo e passo. Use o nome nas regiões abaixo do controle.', 'U(x) := λ_OT·x^2'],
    'btn:Animação': ['Cria uma animação variando um parâmetro, com exportação em GIF, MP4 e PNG.', 'Em “Editar”: escreva as curvas (ex.: y(x, 2, b)), a variável do eixo com o intervalo e o parâmetro animado com valor inicial, final e número de quadros. Depois toque em “Calcular quadros”.', 'y(x, a, b) := a·x + b'],
    'btn:Meu estilo': ['Define o seu estilo de figura (largura, proporção, fonte) para usar nos gráficos.', 'Escolha os valores e salve; depois escolha “Meu estilo” no estilo do gráfico.', ''],
    'btn:Importar tabela': ['Importa .txt, .csv ou .dat (inclusive do Origin, com vírgula decimal) como uma variável-tabela, vetores por coluna e funções de interpolação. Com o nome D1: D1[0] é a coluna 0 e D1[i, j] um elemento.', 'Escolha o arquivo; em Editar, dê o nome da tabela e escolha a interpolação (linear, spline, PCHIP, Akima).', ''],
    'btn:Colar tabela': ['Cria uma variável-tabela a partir de colunas coladas (do Origin, Excel, Planilhas ou de um texto). Com o nome DADO: DADO[0] é a coluna 0, DADO[1] a coluna 1 e DADO[i, j] um elemento.', 'Dê o nome da variável e cole as colunas (a primeira linha pode ter os nomes). Depois use num gráfico: curva do tipo “dados” com x = DADO[0] e y = DADO[1].', ''],
    'btn:Varredura': ['Calcula uma ou mais grandezas variando um parâmetro e mostra tabela e gráfico (exportáveis em TXT).', 'Nome do parâmetro, valores inicial e final, número de pontos e as grandezas, uma por linha.', ''],
    'btn:Ajuste a dados': ['Ajusta (ou só avalia) um modelo a dados com RMS-A, MSE-B, MSE-C e erro padrão.', 'Vetores x e y dos dados, o modelo em x e os parâmetros (nome = valor, [mín, máx] opcional, “fixo”).', ''],
    'btn:Materiais': ['Biblioteca de materiais: constantes fixas usadas como Nome.variável em qualquer folha.', 'Crie o material com definições (n := 1.333, ρ := 997 kg/m^3) e use Água.n.', ''],
    'btn:Tabela de colunas': ['Tabela com uma coluna por expressão (vetores ou variáveis de intervalo), exportável para o Origin.', 'Escreva uma expressão por linha, ex.: x, f(x), g(x, 2).', 'x := 0, 0.5 .. 2\nf(x) := x^2'],
    'btn:Tabela de matriz': ['Mostra uma matriz como tabela, com nomes, unidades e comentários das colunas (TXT do Origin).', 'Escreva o nome da matriz (ex.: Pg) e os nomes das colunas separados por vírgula.', 'g(x, y) := x·y\nPg := tabelaXYZ(g, 0, 1, 2, 0, 1, 2)'],
    'btn:Inserir tabelaXYZ': ['Insere a linha que gera a tabela x, y, g(x, y).', 'Troque g pela sua função e os intervalos.', ''],
    'btn:Região de texto': ['Cria uma região de texto. Aceita ## títulos, **negrito**, *itálico* e fórmulas entre $…$.', 'Toque para escrever.', ''],
    'btn:Região de matemática': ['Cria uma região de matemática.', 'Uma definição ou avaliação por linha.', ''],
    'btn:Novo': ['Abre uma folha nova numa aba nova.', '—', ''],
    'btn:Abrir': ['Abre um arquivo .fcalc numa aba nova.', '—', ''],
    'btn:Salvar': ['Salva a folha como arquivo .fcalc (a folha também fica guardada no aparelho).', '—', ''],
    'btn:Exemplo': ['Abre a folha de exemplo numa aba nova.', '—', ''],
    'btn:Exportar Python': ['Gera um script Python (NumPy/SciPy/Matplotlib) que refaz a folha: valores, gráficos, tabelas, ajustes e animações.', '—', ''],
    'btn:Exportar Markdown': ['Gera uma nota Markdown (Obsidian) com texto, equações em LaTeX, gráficos em PNG, animações em GIF e tabelas.', 'Para incluir animações, calcule os quadros antes.', ''],
    'btn:Exportar MATLAB': ['Gera um arquivo .m com a folha (sem as animações e a óptica).', '—', ''],
    'btn:Ajuda': ['Mostra o resumo da sintaxe e dos recursos.', '—', ''],
    'btn:Teoria': ['Abre a página de teoria com equações, convenções, referências e exemplos que entram na folha com um toque.', '—', ''],
    'btn:Incluir nova ferramenta': ['Monta o prompt para pedir ao Claude um pacote de extensão (.fpack) com funções, aba de botões, teoria, exemplo e ajuda.', 'Descreva o que quer e toque em “Copiar prompt”.', ''],
    'btn:Importar pacote': ['Importa um pacote .fpack (arquivo ou texto colado), verifica e roda os testes antes de instalar.', '—', ''],
    'btn:Pacotes instalados': ['Lista os pacotes: ativar, desativar, teoria, exemplo, salvar, pedir mudança, voltar à versão anterior e remover.', '—', ''],
    'btn:Criar da folha': ['Transforma regiões de matemática da folha num pacote de extensão.', 'Marque as regiões e dê nome, identificador e versão.', ''],
    'btn:Pacote de exemplo': ['Instala o pacote de exemplo “Osciladores de Lorentz”.', '—', '']
  };
  // aliases de rótulos dos botões para as chaves
  const ALIAS = { 'ε₀': 'ε_0', 'μ₀': 'μ_0', 'Mᵀ': 'transpose', 'M⁻¹': 'inv', '|M|': 'det', 'a×b': 'cross', 'a·b': 'dot', autovalores: 'eigs', coluna: 'col', linha: 'row', identidade: 'identity', '∫': 'integral', 'd/dx': 'diff', "f′(x₀)": 'deriv', raiz: 'root', if: 'if', 'Γ': 'gamma', log_b: 'log', 'I foco': 'RW_I', 'E foco': 'RW_campo', 'I interface': 'RWi_I', 'E interface': 'RWi_campo', 'FFT': 'fft2c', 'FFT⁻¹': 'ifft2c', 'esp. angular': 'propEA', 'Fresnel': 'fresnel', 'Fraunhofer': 'fraunhofer', '|U|²': 'intensidade', 'arg U': 'fase', 'U(x, y)': 'amostra', 'lâmina': 'lamina', 'rotação': 'rotacao', 'Stokes': 'stokes', 'α': 'alfaCM', 'α_rad': 'alfaRad', 'σ_esp': 'sigmaScat', 'σ_abs': 'sigmaAbs', 'F_grad': 'Fgrad', 'F_esp': 'Fscat', 'U': 'Uarm', 'z_R': 'zR', 'w(z)': 'wz', 'R(z)': 'Rz', 'ψ(z)': 'gouy', 'E': 'Egauss', 'I': 'Igauss', 'I(P)': 'Ifeixe', 'Bessel': 'besselBeam' };
  FC.TOOL_HELP = H;

  const GREEK = 'αβγδεζηθικλμνξρστυφχψωΓΔΘΛΞΠΣΦΨΩ';
  /* Procura a ajuda de um botão: rótulo, texto inserido e dica */
  FC.toolHelp = function (lab, ins, tip, extra) {
    if (extra && (extra.descricao || extra.entradas || extra.exemplo)) return { t: lab, d: extra.descricao || tip || '', e: extra.entradas || '', x: extra.exemplo || '' };
    const pick = (k) => H[k] ? { t: lab, d: H[k][0], e: H[k][1], x: H[k][2] } : null;
    let r = ins == null ? pick('btn:' + lab) : null;
    if (r) return r;
    const s = String(ins || '');
    const fn = (s.match(/([\p{L}_][\p{L}\p{N}_]*)\s*\(/u) || [])[1];
    if (lab === 'if' && /\n/.test(s)) r = pick('if ');
    r = r || pick(ALIAS[lab]) || pick(lab) || (fn && pick(fn)) || pick(s.trim());
    if (r) return r;
    // funções de pacotes
    for (const pk of (FC.uiExt && FC.uiExt.activePacks ? FC.uiExt.activePacks() : [])) {
      const f = (pk.funcoes || []).find((q) => q.nome === fn || q.nome === lab);
      if (f) return { t: f.assinatura || f.nome, d: (f.descricao || '') + ' (pacote ' + pk.nome + ')', e: f.entradas || ('Assinatura: ' + (f.assinatura || f.nome)), x: f.exemplo || '' };
    }
    if (s.length <= 2 && GREEK.includes(s.trim())) return { t: lab, d: 'Insere a letra grega ' + s.trim() + '. Pode ser usada no texto ou como nome de variável (com subscrito: ' + s.trim() + '_0).', e: 'Atalho: digite a letra latina e Ctrl+G (l → λ).', x: s.trim() + '_0 := 2\n' + s.trim() + '_0^2 =' };
    if (/^ \S/.test(s)) return { t: lab, d: 'Insere a unidade ' + s.trim() + '. Escreva depois de um número; o app converte entre unidades compatíveis.', e: 'número unidade; para ver em outra unidade, termine com “to unidade =”.', x: 'd := 2.5' + s + '\nd =' };
    return tip ? { t: lab, d: tip, e: '', x: '' } : null;
  };
})();
