/* Folha de Cálculo — aba Óptica e página de teoria */
'use strict';
(function () {
  const FC = window.FC;
  FC.uiExt = FC.uiExt || {};
  const U = () => FC._ui;

  FC.uiExt.opticsGroups = [
    ['Feixe gaussiano', [
      ['z_R', 'zR(', ', λ, n)', 'zR(w0, λ, n): comprimento de Rayleigh π w0² n/λ'], ['w(z)', 'wz(', ', w0, λ, n)', 'wz(z, w0, λ, n): raio do feixe'],
      ['R(z)', 'Rz(', ', w0, λ, n)', 'Rz(z, w0, λ, n): raio de curvatura'], ['ψ(z)', 'gouy(', ', w0, λ, n)', 'gouy(z, w0, λ, n): fase de Gouy'],
      ['E', 'Egauss(', ', z, w0, λ, n)', 'Egauss(ρ, z, w0, λ, n): campo complexo (E(0,0) = 1)'], ['I', 'Igauss(', ', z, w0, λ, n)', 'Igauss(ρ, z, w0, λ, n): intensidade normalizada'],
      ['I(P)', 'Ifeixe(', ', z, w0, λ, P, n)', 'Ifeixe(ρ, z, w0, λ, P, n) = 2P/(π w²) e^{−2ρ²/w²}']]],
    ['Modos', [
      ['LG', 'LG(p, l, ', ', φ, z, w0, λ, n)', 'LG(p, l, ρ, φ, z, w0, λ, n): Laguerre–Gauss normalizado'], ['HG', 'HG(m, n, ', ', y, z, w0, λ, nr)', 'HG(m, n, x, y, z, w0, λ, nr): Hermite–Gauss normalizado'],
      ['Bessel', 'besselBeam(l, ', ', φ, z, θ, λ, n)', 'besselBeam(l, ρ, φ, z, θ_cone, λ, n)']]],
    ['Fourier', [
      ['campo', 'U := campo(', ', L, N)', 'campo(f, L, N): matriz N×N de f(x, y) numa janela de lado L'], ['grade', 'grade(', ', N)', 'grade(L, N): coordenadas x_j = (j − N/2) L/N'],
      ['FFT', 'fft2c(', ')', 'Transformada 2D centrada'], ['FFT⁻¹', 'ifft2c(', ')'],
      ['esp. angular', 'propEA(', ', L, λ, z, n)', 'propEA(U, L, λ, z, n): espectro angular (exato, com evanescentes)'], ['Fresnel', 'fresnel(', ', L, λ, z, n)', 'fresnel(U, L, λ, z, n): função de transferência de Fresnel'],
      ['Fraunhofer', 'fraunhofer(', ', L, λ, z, n)', 'fraunhofer(U, L, λ, z, n); a nova janela tem lado fraunL(L, λ, z, N, n)'], ['lente', 'lente(', ', L, λ, f, n)', 'lente(U, L, λ, f, n): fase de lente fina'],
      ['|U|²', 'intensidade(', ')'], ['arg U', 'fase(', ')'], ['U(x, y)', 'amostra(', ', L, x, y)', 'amostra(U, L, x, y): interpolação bilinear'],
      ['circ', 'circ(', ', y, R)', 'circ(x, y, R): abertura circular'], ['rect', 'rect(', ', a)', 'rect(x, a): fenda de largura a']]],
    ['Polarização', [
      ['jones', 'jones("', '")', 'jones("H"), "V", "D", "A", "+" (circular, S₃ = +1), "-"'], ['polarizador', 'polarizador(', ')', 'polarizador(θ)'],
      ['lâmina', 'lamina(', ', θ)', 'lamina(Γ, θ): retardador (λ/4: Γ = π/2; λ/2: Γ = π)'], ['rotação', 'rotacao(', ')'],
      ['Stokes', 'stokes(', ')', 'stokes(J) = [S0; S1; S2; S3]'], ['elipse', 'elipse(', ')', 'elipse(J) = [ψ; χ] (orientação e elipticidade)']]],
    ['Pinças (Rayleigh)', [
      ['CM', 'CM(', ', ε_m)', 'Fator de Clausius–Mossotti'], ['α', 'alfaCM(', ', ε_p, ε_m)', 'alfaCM(a, ε_p, ε_m) = 4π ε0 ε_m a³ CM'], ['α_rad', 'alfaRad(', ', λ, ε_m)', 'Correção radiativa'],
      ['σ_esp', 'sigmaScat(', ', λ, ε_m)'], ['σ_abs', 'sigmaAbs(', ', λ, ε_m)'], ['F_grad', 'Fgrad(', ', dI, n_m)', 'Fgrad(α, ∂I/∂x, n_m)'],
      ['F_esp', 'Fscat(', ', I, λ, n_m)'], ['U', 'Uarm(', ', I, n_m)', 'Uarm(α, I, n_m): energia potencial']]],
    ['Richards–Wolf', [
      ['I foco', 'RW_I(', ', y, z, NA, n, λ, f0, "x", 0)', 'RW_I(x, y, z, NA, n, λ, f0, pol, l): intensidade no foco'],
      ['E foco', 'RW_campo(', ', y, z, NA, n, λ, f0, "x", 0)', 'RW_campo(…) = [Ex; Ey; Ez]'],
      ['I interface', 'RWi_I(', ', y, z, NA, n1, n2, λ, d, f0, "x", 0)', 'Foco através de uma interface (lamínula → água)'],
      ['E interface', 'RWi_campo(', ', y, z, NA, n1, n2, λ, d, f0, "x", 0)']]]
  ];

  /* ---------- Página de teoria ---------- */
  const SEC = [
    { t: 'Convenções', p: [
      'Dependência temporal $e^{-i\\omega t}$; ondas planas $e^{+i\\mathbf{k}\\cdot\\mathbf{r}}$ (como em Novotny & Hecht). Os ângulos são em radianos. Funções que recebem grandezas com unidade convertem tudo para o SI; as que têm resultado dimensional (z_R, w, I, α, σ, F, U) devolvem a unidade SI correspondente. Sem unidades, use qualquer sistema coerente (por exemplo, tudo em µm).',
      'Nas funções de foco, distâncias e λ devem estar na mesma unidade. $n$ é o índice do meio, e o comprimento de onda no meio é $\\lambda/n$.'] },
    { t: 'Feixe gaussiano', p: [
      '$$E(\\rho,z)=\\frac{w_0}{w(z)}\\exp\\!\\left(-\\frac{\\rho^2}{w(z)^2}\\right)\\exp\\!\\left[i\\left(kz-\\psi(z)+\\frac{k\\rho^2}{2R(z)}\\right)\\right]$$',
      '$$z_R=\\frac{\\pi w_0^2 n}{\\lambda},\\quad w(z)=w_0\\sqrt{1+(z/z_R)^2},\\quad R(z)=z\\left[1+(z_R/z)^2\\right],\\quad \\psi(z)=\\arctan(z/z_R)$$',
      'Com potência $P$: $I(\\rho,z)=\\dfrac{2P}{\\pi w^2}\\,e^{-2\\rho^2/w^2}$ (função Ifeixe).'],
      f: [['zR(w0, λ, n)', 'comprimento de Rayleigh'], ['wz, Rz, gouy (z, w0, λ, n)', 'raio, curvatura, fase de Gouy'], ['Egauss(ρ, z, w0, λ, n)', 'campo complexo'], ['Igauss(ρ, z, w0, λ, n)', '|E|² (1 no centro da cintura)'], ['Ifeixe(ρ, z, w0, λ, P, n)', 'intensidade com potência P']],
      ex: 'w_0 := 0.5 µm\nλ_L := 1064 nm\nzR(w_0, λ_L, 1.33) =\nIfeixe(0, 0, w_0, λ_L, 10 mW, 1.33) =' },
    { t: 'Modos Laguerre–Gauss, Hermite–Gauss e Bessel', p: [
      '$$\\mathrm{LG}_p^{l}=\\frac{C_{pl}}{w}\\left(\\frac{\\sqrt2\\rho}{w}\\right)^{|l|}L_p^{|l|}\\!\\left(\\frac{2\\rho^2}{w^2}\\right)e^{-\\rho^2/w^2}\\,e^{il\\phi}\\,e^{i[kz+k\\rho^2/2R-(2p+|l|+1)\\psi]},\\quad C_{pl}=\\sqrt{\\frac{2\\,p!}{\\pi\\,(p+|l|)!}}$$',
      '$$\\mathrm{HG}_{mn}=\\frac{C_{mn}}{w}H_m\\!\\left(\\frac{\\sqrt2x}{w}\\right)H_n\\!\\left(\\frac{\\sqrt2y}{w}\\right)e^{-(x^2+y^2)/w^2}e^{i[kz+k r^2/2R-(m+n+1)\\psi]},\\quad C_{mn}=\\sqrt{\\frac{2}{\\pi\\,2^{m+n}m!\\,n!}}$$',
      'Os dois são normalizados: $\\int|u|^2\\,dA=1$. Feixe de Bessel ideal: $J_l(k\\sin\\theta\\,\\rho)\\,e^{il\\phi}\\,e^{ik\\cos\\theta\\,z}$, com $\\theta$ o semiângulo do cone.'],
      f: [['LG(p, l, ρ, φ, z, w0, λ, n)', 'vórtice com carga l'], ['HG(m, n, x, y, z, w0, λ, nr)', ''], ['besselBeam(l, ρ, φ, z, θ, λ, n)', '']],
      ex: 'I_LG(x, y) := abs(LG(0, 1, sqrt(x^2 + y^2), atan2(y, x), 0, 1, 0.8))^2\nI_LG(0.7, 0) =' },
    { t: 'Óptica de Fourier', p: [
      'O campo é uma matriz $N\\times N$ numa janela de lado $L$, com $x_j=(j-N/2)\\,L/N$ (linhas = y, colunas = x). As transformadas fft2c e ifft2c são centradas.',
      'Espectro angular (exato, inclui ondas evanescentes): $$U(x,y,z)=\\mathcal F^{-1}\\!\\left\\{\\mathcal F\\{U_0\\}\\,e^{ik_z z}\\right\\},\\qquad k_z=\\sqrt{k^2-k_x^2-k_y^2}$$',
      'Fresnel (paraxial): $H=e^{ikz}\\,e^{-i\\pi\\lambda z(f_x^2+f_y^2)}$. Use a função de transferência quando $\\Delta x\\gtrsim\\lambda z/L$; para distâncias maiores, Fraunhofer.',
      'Fraunhofer: $$U(x,y)=\\frac{e^{ikz}e^{ik(x^2+y^2)/2z}}{i\\lambda z}\\,\\mathcal F\\{U_0\\}\\!\\left(\\frac{x}{\\lambda z},\\frac{y}{\\lambda z}\\right)$$ A janela de saída tem lado $L\'=\\lambda z N/L$ (função fraunL).',
      'Lente fina: $U\\,e^{-ik(x^2+y^2)/2f}$. Para mostrar um campo, use num mapa de calor uma expressão-matriz, como intensidade(U), com mínimo e máximo de x e y iguais a $-L/2$ e $L/2-L/N$.'],
      f: [['campo(f, L, N)', 'amostra f(x, y) na grade'], ['grade(L, N)', 'vetor de coordenadas'], ['propEA, fresnel, fraunhofer (U, L, λ, z, n)', 'propagação'], ['lente(U, L, λ, f, n)', ''], ['amostra(U, L, x, y)', 'valor interpolado'], ['intensidade(U), fase(U)', ''], ['circ(x, y, R), rect(x, a)', 'aberturas']],
      ex: 'L_F := 2 mm\nN_F := 256\nab(x, y) := circ(x, y, 0.25 mm)\nU_0 := campo(ab, L_F, N_F)\nU_z := fresnel(U_0, L_F, 633 nm, 5 cm, 1)\nI_z := intensidade(U_z)' },
    { t: 'Polarização: Jones e Stokes', p: [
      'Vetor de Jones $\\mathbf J=[E_x;E_y]$. "+" é $[1;i]/\\sqrt2$, com $S_3=+1$. Polarizador a $\\theta$: $\\begin{bmatrix}\\cos^2\\theta&\\cos\\theta\\sin\\theta\\\\\\cos\\theta\\sin\\theta&\\sin^2\\theta\\end{bmatrix}$. Retardador $\\Gamma$ com eixo rápido em $\\theta$: $R(\\theta)\\,\\mathrm{diag}(1,e^{i\\Gamma})\\,R(-\\theta)$.',
      '$$S_0=|E_x|^2+|E_y|^2,\\ S_1=|E_x|^2-|E_y|^2,\\ S_2=2\\,\\mathrm{Re}(E_x^*E_y),\\ S_3=2\\,\\mathrm{Im}(E_x^*E_y)$$',
      'elipse(J) devolve a orientação $\\psi=\\tfrac12\\operatorname{atan2}(S_2,S_1)$ e a elipticidade $\\chi=\\tfrac12\\arcsin(S_3/S_0)$.'],
      f: [['jones("H")', 'H, V, D, A, +, −'], ['polarizador(θ), lamina(Γ, θ), rotacao(θ)', 'matrizes 2×2'], ['stokes(J), elipse(J)', '']],
      ex: 'J_s := lamina(π/2, π/4)·jones("H")\nstokes(J_s) =' },
    { t: 'Pinças ópticas no regime de Rayleigh', p: [
      'Para $a\\ll\\lambda$: $$\\alpha=4\\pi\\varepsilon_0\\varepsilon_m a^3\\,\\frac{\\varepsilon_p-\\varepsilon_m}{\\varepsilon_p+2\\varepsilon_m},\\qquad \\alpha_{rad}=\\frac{\\alpha}{1-i\\,\\dfrac{k^3}{6\\pi\\varepsilon_0\\varepsilon_m}\\,\\alpha}$$',
      '$$\\mathbf F_{grad}=\\frac{\\mathrm{Re}\\,\\alpha}{2cn_m\\varepsilon_0}\\nabla I,\\qquad F_{esp}=\\frac{n_m}{c}(\\sigma_{esp}+\\sigma_{abs})\\,I,\\qquad U=-\\frac{\\mathrm{Re}\\,\\alpha}{2cn_m\\varepsilon_0}I$$',
      '$$\\sigma_{esp}=\\frac{k^4|\\alpha|^2}{6\\pi\\varepsilon_0^2\\varepsilon_m^2},\\qquad \\sigma_{abs}=\\frac{k\\,\\mathrm{Im}\\,\\alpha}{\\varepsilon_0\\varepsilon_m},\\qquad k=\\frac{2\\pi n_m}{\\lambda_0}$$',
      'Fgrad e U coincidem com Harada & Asakura para $\\alpha$ de Clausius–Mossotti. Uma armadilha estável costuma exigir $|U|\\gtrsim 10\\,k_BT$.'],
      f: [['CM(εp, εm)', 'Clausius–Mossotti'], ['alfaCM(a, εp, εm), alfaRad(α, λ, εm)', 'polarizabilidade (F·m²)'], ['sigmaScat, sigmaAbs (α, λ, εm)', 'seções de choque (m²)'], ['Fgrad(α, ∂I/∂x, n_m), Fscat(α, I, λ, n_m)', 'forças (N)'], ['Uarm(α, I, n_m)', 'energia (J)']],
      ex: 'α_PS := alfaCM(25 nm, 1.59^2, 1.33^2)\nI_pico := Ifeixe(0, 0, 0.5 µm, 1064 nm, 100 mW, 1.33)\nUarm(α_PS, I_pico, 1.33)/(k_B·295 K) =' },
    { t: 'Richards–Wolf: focalização por uma objetiva', p: [
      'Integral vetorial de Debye para uma objetiva aplanática (condição do seno), com fator de apodização $\\sqrt{\\cos\\theta}$:',
      '$$\\mathbf E(\\rho,\\varphi,z)\\propto\\int_0^{\\theta_{max}}\\!\\!\\int_0^{2\\pi}\\mathbf E_\\infty(\\theta,\\phi)\\,e^{ikz\\cos\\theta}\\,e^{ik\\rho\\sin\\theta\\cos(\\phi-\\varphi)}\\sin\\theta\\,d\\phi\\,d\\theta,\\qquad \\sin\\theta_{max}=\\frac{\\mathrm{NA}}{n}$$',
      '$$\\mathbf E_\\infty=A(\\theta)\\sqrt{\\cos\\theta}\\left[t_s(\\mathbf E_{inc}\\cdot\\mathbf n_\\phi)\\,\\mathbf n_\\phi+t_p(\\mathbf E_{inc}\\cdot\\mathbf n_\\rho)\\,\\mathbf n_\\theta\\right],\\qquad A(\\theta)=e^{-\\sin^2\\theta/(f_0^2\\sin^2\\theta_{max})}$$',
      'O fator de preenchimento é $f_0=w_0/(f\\sin\\theta_{max})$; use f0 = 1e9 para iluminação uniforme (disco de Airy). Para polarização x as integrais se reduzem a $E\\propto[I_{00}+I_{02}\\cos2\\varphi;\\ I_{02}\\sin2\\varphi;\\ -2iI_{01}\\cos\\varphi]$ (Novotny & Hecht, cap. 3); o app reproduz essas fórmulas.',
      'Polarizações: "x", "y", "circ+", "circ-", "radial" e "azimutal". O último argumento $l$ multiplica a pupila por $e^{il\\phi}$ (vórtice); radial, azimutal e $l\\neq0$ usam perfil de rosca $(\\sin\\theta/f_0\\sin\\theta_{max})^{|l|}e^{-(\\ldots)^2}$. A integral em $\\phi$ é feita por harmônicos: $\\int_0^{2\\pi}e^{im\\phi}e^{ia\\cos(\\phi-\\varphi)}d\\phi=2\\pi i^mJ_m(a)e^{im\\varphi}$, e a integral em $\\theta$ por Gauss–Legendre com 96 pontos.',
      'Interface (Török et al.): o feixe sai do meio $n_1$ (óleo/vidro) e entra no meio $n_2$ (água) numa interface plana em $z=0$; $d$ é a profundidade nominal. Fase $k_0(n_2z\\cos\\theta_2-n_1d\\cos\\theta_1)$, Snell $n_1\\sin\\theta_1=n_2\\sin\\theta_2$ e coeficientes de Fresnel $t_s=\\dfrac{2n_1\\cos\\theta_1}{n_1\\cos\\theta_1+n_2\\cos\\theta_2}$, $t_p=\\dfrac{2n_1\\cos\\theta_1}{n_2\\cos\\theta_1+n_1\\cos\\theta_2}$ ($\\cos\\theta_2$ complexo além do ângulo crítico, ondas evanescentes). No limite paraxial o foco fica em $z\\approx d\\,n_2/n_1$; em NA alta aparecem a aberração esférica e o alargamento axial.',
      'Normalização: RW_I e RWi_I valem 1 no pico do foco com polarização x, mesmos NA, n e f0 e sem deslocamento ($d=0$). RW_campo devolve $[E_x;E_y;E_z]$ complexo na mesma escala.'],
      f: [['RW_I(x, y, z, NA, n, λ, f0, pol, l)', 'intensidade (meio único)'], ['RW_campo(…)', '[Ex; Ey; Ez]'], ['RWi_I(x, y, z, NA, n1, n2, λ, d, f0, pol, l)', 'através de interface'], ['RWi_campo(…)', '']],
      ex: 'I_RW(x, z) := RW_I(x, 0, z, 1.2, 1.33, 1.064, 1, "x", 0)\nI_RW(0.3, 0) =\nI_ef(z) := RWi_I(0, 0, z, 1.3, 1.515, 1.33, 1.064, 10, 1, "circ+", 0)' },
    { t: 'Referências', p: [
      'B. Richards e E. Wolf, Proc. R. Soc. Lond. A 253, 358 (1959).',
      'L. Novotny e B. Hecht, Principles of Nano-Optics, 2ª ed., Cambridge (2012), cap. 3.',
      'P. Török, P. Varga, Z. Laczik e G. R. Booker, J. Opt. Soc. Am. A 12, 325 (1995).',
      'Y. Harada e T. Asakura, Opt. Commun. 124, 529 (1996).',
      'J. W. Goodman, Introduction to Fourier Optics, 3ª ed. (2005); A. E. Siegman, Lasers (1986); D. G. Voelz, Computational Fourier Optics (2011).'] }
  ];
  function rich(txt) {
    // $$…$$ em destaque, $…$ no texto
    const parts = String(txt).split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/);
    return parts.map((s) => {
      if (/^\$\$/.test(s)) return '<div class="eqd">' + katex.renderToString(s.slice(2, -2), { displayMode: true, throwOnError: false }) + '</div>';
      if (/^\$/.test(s)) return katex.renderToString(s.slice(1, -1), { throwOnError: false });
      return U().esc(s);
    }).join('');
  }
  FC.uiExt.theoryDialog = function (title, SEC) {
    const { h, icon, toast } = U();
    const wrap = h('div', { class: 'overlay', onclick: (e) => { if (e.target === wrap) wrap.remove(); } });
    const close = h('button', { class: 'ib close', 'aria-label': 'Fechar', onclick: () => wrap.remove() }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 18));
    const body = h('div', { class: 'hbody theory' });
    const nav = h('div', { class: 'thnav' });
    SEC.forEach((s, i) => {
      const sec = h('section', { id: 'th' + i }, h('h3', null, s.t));
      for (const p of s.p) { const d = h('div', { class: 'thp' }); d.innerHTML = rich(p); sec.append(d); }
      if (s.f) sec.append(h('table', null, ...s.f.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, b)))));
      if (s.ex) {
        const pre = h('pre', { class: 'thex' }, s.ex);
        const b = h('button', { class: 'btn small', onclick: () => { U().addRegion('math', { src: s.ex, w: 'half' }); wrap.remove(); toast('Exemplo inserido na folha.'); } }, 'Inserir exemplo na folha');
        sec.append(h('div', { class: 'thexw' }, pre, b));
      }
      body.append(sec);
      nav.append(h('button', { class: 'chip', onclick: () => body.querySelector('#th' + i).scrollIntoView({ behavior: 'smooth', block: 'start' }) }, s.t.split(':')[0]));
    });
    const panel = h('div', { class: 'hpanel', role: 'dialog', 'aria-label': 'Teoria de óptica' },
      h('div', { class: 'hhead' }, title, close), nav, body);
    wrap.append(panel);
    document.body.append(wrap);
  };
  FC.uiExt.openTheory = () => FC.uiExt.theoryDialog('Óptica: teoria, equações e funções', SEC);
  FC.uiExt.opticsExtra = function () {
    const { h, icon } = U();
    return [h('button', { class: 'tool big', onclick: FC.uiExt.openTheory }, icon('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 8h6M9 12h4"/>', 22), h('span', null, 'Teoria'))];
  };
})();
