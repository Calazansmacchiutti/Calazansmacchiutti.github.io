/* Filtro por tema da seção de projetos.
   Cada botão tem data-filter (ou "all"); cada item tem data-themes="a b".
   Itens fora do tema recebem o atributo hidden. */
(function () {
	function init() {
		var bar = document.querySelector('#projects .pfilter');
		if (!bar) return;
		var buttons = bar.querySelectorAll('button[data-filter]');
		var items = document.querySelectorAll('#projects [data-themes]');

		function select(filter) {
			for (var i = 0; i < buttons.length; i++) {
				buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-filter') === filter ? 'true' : 'false');
			}
			for (var j = 0; j < items.length; j++) {
				var themes = ' ' + items[j].getAttribute('data-themes') + ' ';
				items[j].hidden = !(filter === 'all' || themes.indexOf(' ' + filter + ' ') !== -1);
			}
		}

		bar.addEventListener('click', function (ev) {
			var b = ev.target.closest('button[data-filter]');
			if (b) select(b.getAttribute('data-filter'));
		});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
