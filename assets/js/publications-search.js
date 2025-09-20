// Publications search functionality
document.addEventListener('DOMContentLoaded', function() {
  // Create search input if it doesn't exist
  const publicationsContainer = document.querySelector('.publications');
  if (!publicationsContainer) return;

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'bibsearch';
  searchInput.className = 'search bibsearch-form-input';
  searchInput.placeholder = 'Type to filter publications...';
  searchInput.style.cssText = `
    width: 100%;
    padding: 12px 16px;
    margin-bottom: 2rem;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 16px;
    background-color: var(--global-bg-color);
    color: var(--global-text-color);
    transition: border-color 0.3s ease;
  `;

  // Insert search input before publications
  publicationsContainer.parentNode.insertBefore(searchInput, publicationsContainer);

  // Add focus styles
  searchInput.addEventListener('focus', function() {
    this.style.borderColor = 'var(--global-link-color)';
    this.style.outline = 'none';
  });

  searchInput.addEventListener('blur', function() {
    this.style.borderColor = '#e9ecef';
  });

  // Get all publication items
  const publicationItems = document.querySelectorAll('.bibliography li');

  // Search functionality
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    
    publicationItems.forEach(item => {
      const title = item.querySelector('.title')?.textContent.toLowerCase() || '';
      const authors = item.querySelector('.author')?.textContent.toLowerCase() || '';
      const journal = item.querySelector('.periodical')?.textContent.toLowerCase() || '';
      const abstract = item.querySelector('.abstract p')?.textContent.toLowerCase() || '';
      
      const matches = title.includes(searchTerm) || 
                     authors.includes(searchTerm) || 
                     journal.includes(searchTerm) || 
                     abstract.includes(searchTerm);
      
      if (matches || searchTerm === '') {
        item.style.display = 'block';
        item.style.animation = 'fadeIn 0.3s ease';
      } else {
        item.style.display = 'none';
      }
    });

    // Hide empty years
    document.querySelectorAll('.bibliography').forEach(yearSection => {
      const visibleItems = yearSection.querySelectorAll('li[style*="block"], li:not([style*="none"])');
      if (visibleItems.length === 0) {
        yearSection.style.display = 'none';
      } else {
        yearSection.style.display = 'block';
      }
    });
  });

  // Add fade-in animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .search {
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .search:focus {
      box-shadow: 0 4px 8px rgba(47, 127, 147, 0.2);
    }
  `;
  document.head.appendChild(style);
});
