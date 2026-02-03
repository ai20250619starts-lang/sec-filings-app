const state = {
    page: 1,
    perPage: 10,
    total: 0
};

document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    fetchFilings();

    // Event Listeners
    document.getElementById('searchBtn').addEventListener('click', () => {
        state.page = 1;
        fetchFilings();
    });

    // We'll delegate event listeners for pagination since buttons are dynamic
    document.getElementById('paginationControls').addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;

        const action = btn.dataset.action;
        const targetPage = parseInt(btn.dataset.page);

        if (action === 'prev' && state.page > 1) {
            state.page--;
            fetchFilings();
        } else if (action === 'next') {
            const maxPages = Math.ceil(state.total / state.perPage);
            if (state.page < maxPages) {
                state.page++;
                fetchFilings();
            }
        } else if (action === 'first') {
            state.page = 1;
            fetchFilings();
        } else if (action === 'last') {
            const maxPages = Math.ceil(state.total / state.perPage);
            state.page = maxPages;
            fetchFilings();
        } else if (targetPage) {
            state.page = targetPage;
            fetchFilings();
        }
    });
});

async function fetchFilings() {
    const cik = document.getElementById('cik').value;
    const group = document.getElementById('groupSelect').value;
    const year = document.getElementById('yearSelect').value;

    const loader = document.getElementById('loader');
    const tbody = document.getElementById('resultsBody');

    loader.classList.add('active');
    // tbody.innerHTML = ''; // Keep table headers but clear body - moved to renderTable

    const params = new URLSearchParams({
        cik: cik,
        page: state.page,
        per_page: state.perPage
    });

    if (group && group !== 'All') params.append('group', group);
    if (year && year !== 'All') params.append('year', year);

    try {
        const response = await fetch(`/api/filings?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }

        state.total = data.total;

        // Populate dropdowns if they are empty (first run or if lists grow, but usually first run is enough unless CIK changes)
        // Ideally we should re-populate on CIK change, but for now lets do it if options < 2
        updateDropdown('yearSelect', data.available_years);
        updateDropdown('groupSelect', data.available_groups);

        // Update selected values back
        if (group) document.getElementById('groupSelect').value = group;
        if (year) document.getElementById('yearSelect').value = year;

        renderTable(data.data);
        updatePaginationLogic();

    } catch (err) {
        console.error(err);
        alert('Failed to fetch data. Ensure backend is running.');
    } finally {
        loader.classList.remove('active');
    }
}

function updateDropdown(id, items) {
    const select = document.getElementById(id);
    const currentValue = select.value;
    select.innerHTML = '<option value="All">All</option>';
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        option.textContent = item;
        select.appendChild(option);
    });
    if (items.includes(currentValue) || currentValue === 'All') {
        select.value = currentValue;
    }
}

function renderTable(filings) {
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = ''; // Clear previous results here to be safe

    if (filings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No filings found</td></tr>';
        return;
    }

    filings.forEach(filing => {
        // Format date: 2023-11-15 
        // Input is YYYY-MM-DD. Let's make it look like "Nov 15, 2023"
        const dateObj = new Date(filing.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td>${filing.form}</td>
            <td>${filing.description || filing.primaryDocument}</td>
            <td>${filing.group}</td>
            <td class="icons-cell">
                <a href="${filing.link}" target="_blank" class="icon-link icon-chain" title="Primary Document">
                    <svg><use href="#icon-chain"></use></svg>
                </a>
                <a href="${filing.link}" target="_blank" class="icon-link icon-pdf" title="PDF (Simulator)">
                    <svg><use href="#icon-pdf"></use></svg>
                </a>
                <a href="${filing.details_link}" target="_blank" class="icon-link icon-word" title="Details">
                    <svg><use href="#icon-word"></use></svg>
                </a>
                 <a href="#" class="icon-link icon-x" title="XBRL (Simulator)">
                    <svg><use href="#icon-x"></use></svg>
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updatePaginationLogic() {
    const container = document.getElementById('paginationControls');
    const resultsCount = document.getElementById('resultsCount');
    const totalPages = Math.ceil(state.total / state.perPage) || 1;
    const currentPage = state.page;

    // Update results text
    const start = (currentPage - 1) * state.perPage + 1;
    const end = Math.min(currentPage * state.perPage, state.total);
    resultsCount.textContent = `Displaying ${state.total > 0 ? start : 0} - ${end} of ${state.total} results`;

    let html = '';

    // First Page (« by convention or double arrow)
    html += `<button class="page-btn" data-action="first" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;

    // Previous Page (‹)
    html += `<button class="page-btn" data-action="prev" ${currentPage === 1 ? 'disabled' : ''}>&lsaquo;</button>`;

    // Page Numbers logic
    // We want to show a window of pages, e.g., ... 14 15 16 ...
    // Let's show up to 5 numbers centered around current
    const windowSize = 2; // +/- 2
    let startPage = Math.max(1, currentPage - windowSize);
    let endPage = Math.min(totalPages, currentPage + windowSize);

    // Adjust if near ends
    if (currentPage <= windowSize + 1) {
        endPage = Math.min(totalPages, 5);
    }
    if (currentPage >= totalPages - windowSize) {
        startPage = Math.max(1, totalPages - 4);
    }

    if (startPage > 1) {
        html += `<span style="padding:0.5rem">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        html += `<span style="padding:0.5rem">...</span>`;
    }

    // Next Page (›)
    html += `<button class="page-btn" data-action="next" ${currentPage === totalPages ? 'disabled' : ''}>&rsaquo;</button>`;

    // Last Page (»)
    html += `<button class="page-btn" data-action="last" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;

    container.innerHTML = html;
}

