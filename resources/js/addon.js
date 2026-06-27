(function () {
    'use strict';

    Statamic.booting(() => {
        const { h, ref, computed } = window.Vue;

        Statamic.$components.register('border-radius-fieldtype', {
            inheritAttrs: false,
            props: {
                value:  { default: null },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'focus', 'blur'],
            setup(props, { emit }) {
                const minVal   = computed(() => props.config.min  ?? 0);
                const maxVal   = computed(() => props.config.max  ?? 100);
                const stepSize = computed(() => props.config.step ?? 1);
                const numSteps = computed(() => Math.round((maxVal.value - minVal.value) / stepSize.value) + 1);
                const visual   = computed(() => numSteps.value);

                // Unit is stored in the value object, falling back to config
                const currentUnit = ref(props.config.unit || 'px');

                function parseData(val) {
                    if (val && !Array.isArray(val) && typeof val === 'object' && val.rows) {
                        currentUnit.value = val.unit || props.config.unit || 'px';
                        return parseRowsArray(val.rows);
                    }
                    return parseRowsArray(val);
                }

                function parseRowsArray(val) {
                    if (Array.isArray(val) && val.length > 0) {
                        return val.map(r => {
                            const isCustom = r.custom ?? (typeof r.value === 'string' && isNaN(Number(r.value)));
                            return {
                                corners:   Array.isArray(r.corners) ? [...r.corners] : ['top-left'],
                                value:     isCustom ? minVal.value : (r.value ?? minVal.value),
                                custom:    isCustom,
                                customVal: isCustom ? String(r.value) : '',
                            };
                        });
                    }
                    return [{ corners: ['top-left'], value: minVal.value, custom: false, customVal: '' }];
                }

                const rows      = ref(parseData(props.value));
                const trackRefs = ref([]);

                function emitRows() {
                    emit('update:value', {
                        unit: currentUnit.value,
                        rows: rows.value.map(r => ({
                            corners: r.corners,
                            value:   r.custom ? (r.customVal || null) : r.value,
                            custom:  r.custom,
                        })),
                    });
                }

                function toggleCorner(rowIdx, corner) {
                    const row = rows.value[rowIdx];
                    const idx = row.corners.indexOf(corner);
                    if (idx === -1) row.corners.push(corner);
                    else row.corners.splice(idx, 1);
                    emitRows();
                }

                function addRow() {
                    rows.value.push({ corners: ['top-left'], value: minVal.value, custom: false, customVal: '' });
                    emitRows();
                }

                function removeRow(idx) {
                    rows.value.splice(idx, 1);
                    emitRows();
                }

                function stepFromX(rowIdx, clientX) {
                    const el = trackRefs.value[rowIdx];
                    if (!el) return minVal.value;
                    const rect  = el.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    const idx   = Math.round(ratio * (visual.value - 1));
                    return minVal.value + idx * stepSize.value;
                }

                function onMousedown(rowIdx, e) {
                    if (e.button !== 0) return;
                    emit('focus');
                    rows.value[rowIdx].value = stepFromX(rowIdx, e.clientX);
                    emitRows();
                    const move = (mv) => { rows.value[rowIdx].value = stepFromX(rowIdx, mv.clientX); emitRows(); };
                    const up   = ()   => { emit('blur'); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
                    document.addEventListener('mousemove', move);
                    document.addEventListener('mouseup', up);
                }

                function onKeydown(rowIdx, e) {
                    const row = rows.value[rowIdx];
                    let idx = Math.round((row.value - minVal.value) / stepSize.value);
                    if      (e.key === 'ArrowRight' || e.key === 'ArrowUp')   idx = Math.min(numSteps.value - 1, idx + 1);
                    else if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') idx = Math.max(0, idx - 1);
                    else if (e.key === 'Home') idx = 0;
                    else if (e.key === 'End')  idx = numSteps.value - 1;
                    else return;
                    e.preventDefault();
                    row.value = Math.max(minVal.value, minVal.value + idx * stepSize.value);
                    emitRows();
                }

                function toggleCustom(rowIdx) {
                    const row = rows.value[rowIdx];
                    row.custom = !row.custom;
                    if (row.custom) {
                        row.customVal = row.value > 0 ? row.value + currentUnit.value : '';
                    } else {
                        row.customVal = '';
                        row.value = 0;
                    }
                    emitRows();
                }

                function clickableCornerSvg(activeCorners, rowIdx) {
                    const corners = [
                        { corner: 'top-left',     path: 'M 7.5 2 A 5.5 5.5 0 0 0 2 7.5',    hx: 0,  hy: 0,  hw: 10, hh: 10 },
                        { corner: 'top-right',    path: 'M 12.5 2 A 5.5 5.5 0 0 1 18 7.5',   hx: 10, hy: 0,  hw: 10, hh: 10 },
                        { corner: 'bottom-right', path: 'M 18 12.5 A 5.5 5.5 0 0 1 12.5 18', hx: 10, hy: 10, hw: 10, hh: 10 },
                        { corner: 'bottom-left',  path: 'M 7.5 18 A 5.5 5.5 0 0 1 2 12.5',   hx: 0,  hy: 10, hw: 10, hh: 10 },
                    ];

                    return h('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none', style: 'display:block;flex-shrink:0;user-select:none' },
                        corners.flatMap(({ corner, path, hx, hy, hw, hh }) => [
                            h('path', {
                                d: path,
                                stroke: activeCorners.includes(corner) ? '#3b82f6' : '#d1d5db',
                                'stroke-width': '3',
                                'stroke-linecap': 'butt',
                                fill: 'none',
                            }),
                            h('rect', {
                                x: hx, y: hy, width: hw, height: hh,
                                fill: 'transparent',
                                style: 'cursor:pointer',
                                onClick: (e) => { e.stopPropagation(); toggleCorner(rowIdx, corner); },
                            }),
                        ])
                    );
                }

                function pencilSvg() {
                    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', style: 'display:block' }, [
                        h('path', { fill: 'currentColor', d: 'm12.9 6.855l4.242 4.242l-9.9 9.9H3v-4.243zm1.414-1.415l2.121-2.121a1 1 0 0 1 1.414 0l2.829 2.828a1 1 0 0 1 0 1.415l-2.122 2.121z' }),
                    ]);
                }

                function plusSvg() {
                    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', style: 'display:block' }, [
                        h('path', { fill: 'currentColor', d: 'M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z' }),
                    ]);
                }

                function xSvg() {
                    return h('svg', { width: '12', height: '12', viewBox: '0 0 24 24', style: 'display:block' }, [
                        h('path', { fill: 'currentColor', d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' }),
                    ]);
                }

                return () => {
                    const rowEls = rows.value.map((row, rowIdx) => {
                        const v   = row.custom ? minVal.value : (row.value ?? minVal.value);
                        const vi  = Math.round((v - minVal.value) / stepSize.value);
                        const pct = visual.value > 1 ? Math.max(0, Math.min(100, (vi / (visual.value - 1)) * 100)) : 0;
                        const cm        = row.custom;

                        return h('div', { key: rowIdx, class: 'vzl-br-row' }, [
                            clickableCornerSvg(row.corners, rowIdx),

                            cm
                                ? h('input', {
                                    value:       row.customVal,
                                    placeholder: 'f.eks. 5rem',
                                    class:       'cp-input vzl-br-input',
                                    onInput:     (e) => { rows.value[rowIdx].customVal = e.target.value; emitRows(); },
                                    onFocus:     () => emit('focus'),
                                    onBlur:      () => emit('blur'),
                                })
                                : h('div', {
                                    ref:         el => { trackRefs.value[rowIdx] = el; },
                                    tabindex:    '0',
                                    class:       'vzl-br-track',
                                    onMousedown: (e) => onMousedown(rowIdx, e),
                                    onKeydown:   (e) => onKeydown(rowIdx, e),
                                    onFocus:     () => emit('focus'),
                                    onBlur:      () => emit('blur'),
                                }, [
                                    h('div', { key: 'bg',   class: 'vzl-br-track-bg' }),
                                    h('div', { key: 'fill', class: 'vzl-br-track-fill', style: { width: pct + '%' } }),
                                    h('div', { key: 'dot',  class: 'vzl-br-track-dot',  style: { left: pct + '%' } }),
                                ]),

                            !cm
                                ? h('span', { class: 'vzl-br-value' }, v + currentUnit.value)
                                : null,

                            !cm
                                ? h('div', { class: 'vzl-br-unit-toggle' },
                                    ['px', 'rem', 'em', '%'].map(u =>
                                        h('button', {
                                            type:    'button',
                                            class:   ['vzl-br-unit-btn', currentUnit.value === u ? 'is-active' : ''],
                                            onClick: () => { currentUnit.value = u; emitRows(); },
                                        }, u)
                                    )
                                )
                                : null,

                            h('button', {
                                type:    'button',
                                title:   cm ? 'Brug slider' : 'Angiv custom værdi',
                                class:   ['vzl-br-edit', cm ? 'is-active' : ''],
                                onClick: () => toggleCustom(rowIdx),
                            }, pencilSvg()),

                            rows.value.length > 1
                                ? h('button', {
                                    type:    'button',
                                    title:   'Fjern',
                                    class:   'vzl-br-remove-btn',
                                    onClick: () => removeRow(rowIdx),
                                }, xSvg())
                                : null,
                        ]);
                    });

                    const unitToggle = rows.value.length < 4
                        ? h('div', { class: 'vzl-br-footer' }, [
                            h('button', {
                                type:    'button',
                                class:   'vzl-br-add-btn',
                                onClick: addRow,
                            }, [plusSvg(), 'Tilføj']),
                          ])
                        : null;

                    return h('div', { class: 'vzl-br-sides' }, [...rowEls, unitToggle]);
                };
            },
        });

    });
}());
