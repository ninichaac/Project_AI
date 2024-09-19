// ======= Header =======
function handleLogout() {
  fetch('/logout', {
    method: 'POST',
    credentials: 'include'  // Include cookies for authentication
  })
    .then(response => {
      if (response.ok) {
        window.location.href = '/login';  // Redirect to login page or home page
      } else {
        console.error('Logout failed');
      }
    })
    .catch(error => {
      console.error('Error:', error);
    });
}
// ======= End Header =======


// ======= Home Section =======
// Initialize file upload status
let isFileUploaded = false;

// File upload handler
document.getElementById('file').addEventListener('change', function (event) {
  const file = event.target.files[0];
  const filename = file ? file.name : '';
  const fileExtension = filename.split('.').pop().toLowerCase();

  if (fileExtension === 'csv') {
    document.getElementById('dropImage').src = 'public/img/csv.png';
    document.getElementById('file-name').innerText = filename;

    document.getElementById('submit-form').innerText = 'Upload';
    document.getElementById('submit-form').classList.remove('confirmed');
    document.getElementById('submit-form').disabled = false;
  } else {
    alert('Please select a CSV file.');
    event.target.value = ''; // Clear the input field
  }
});

document.getElementById('uploadForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  const formData = new FormData();
  const fileField = document.querySelector('input[type="file"]');
  formData.append('file', fileField.files[0]);

  // Show Swal loading spinner
  Swal.fire({
    title: 'Uploading...',
    text: 'Please wait while the file is being uploaded.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      isFileUploaded = true;
      document.getElementById('submit-form').innerText = 'Uploaded';
      document.getElementById('submit-form').classList.add('confirmed');
      document.getElementById('submit-form').disabled = true;
      Swal.close();

      Swal.fire({
        title: 'Success',
        text: 'File uploaded successfully.',
        icon: 'success'
      }).then(() => {
        Swal.fire({
          title: 'Preparing files...',
          text: 'Please wait while we prepare the file for processing.',
          allowOutsideClick: false,
          timer: 20000,
          didOpen: () => {
            Swal.showLoading();
          }
        });
      });
    } else {
      throw new Error('File upload failed');
    }
  } catch (error) {
    console.error('Error:', error);
    Swal.close();
    Swal.fire({
      title: 'Error',
      text: 'Error uploading file',
      icon: 'error'
    });
  } finally {
    // Reset image and header text after upload
    document.getElementById('dropImage').src = 'public/img/csv.png';
    document.getElementById('file-name').innerText = filename;
  }
});

// Training initiation
function startTraining() {
  if (!isFileUploaded) {
    Swal.fire({
      title: 'Error',
      text: 'Please upload a file before starting processing.',
      icon: 'error'
    });
    return;
  }

  Swal.fire({
    title: 'Processing in progress',
    text: 'Please wait when processing is complete..',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
      fetch('/start_training', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
          Swal.close();
          Swal.fire({
            title: 'Success',
            text: 'Processing started successfully.',
            icon: 'success'
          }).then(() => {
            window.location.reload();
          });
        })
        .catch(error => {
          Swal.close();
          Swal.fire({
            title: 'Error',
            text: 'There was an error starting the processing. Please try again.',
            icon: 'error'
          });
          console.error('Error:', error);
        });
    }
  });
}

document.getElementById('start-training-button').addEventListener('click', startTraining);
// ======= End Home Section =======



// ======= Analysis Section =======
document.addEventListener('DOMContentLoaded', function () {
  const tableBody = document.getElementById('table-body');

  // Fetch data from MongoDB (simulated here)
  async function fetchData() {
    try {
      // Replace with actual fetch or AJAX call to your MongoDB data
      const response = await fetch('/data');
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      return [];
    }
  }

  async function populateTable() {
    const data = await fetchData();

    data.forEach((item, index) => {
      const row = document.createElement('tr');

      // Create cells for each data field
      const noCell = document.createElement('td');
      const countryCell = document.createElement('td');
      const sourceIPCell = document.createElement('td');
      const destinationIPCell = document.createElement('td');
      const destinationPortCell = document.createElement('td');
      const threatInfoCell = document.createElement('td');
      const statusCell = document.createElement('td');

      noCell.textContent = index + 1;
      countryCell.textContent = item.Country;
      sourceIPCell.textContent = item["Source IP"];
      destinationIPCell.textContent = item["Destination IP"];
      destinationPortCell.textContent = item["Destination Port"];
      threatInfoCell.textContent = item["Threat Information"];
      statusCell.textContent = item.status;

      // Append cells to the row
      row.appendChild(noCell);
      row.appendChild(countryCell);
      row.appendChild(sourceIPCell);
      row.appendChild(destinationIPCell);
      row.appendChild(destinationPortCell);
      row.appendChild(threatInfoCell);
      row.appendChild(statusCell);

      // Append row to the table body
      tableBody.appendChild(row);
    });
  }

  populateTable();
});
// ======= End Analysis Section =======



// ======= History Section =======
document.addEventListener('DOMContentLoaded', function () {
  (async function () {
    const tableBody = document.getElementById('download_csv').querySelector('tbody');

    async function fetchCsvFiles() {
      try {
        const response = await fetch('/listCsvFiles');
        return await response.json();
      } catch (error) {
        console.error('Error fetching CSV files:', error);
        return [];
      }
    }

    const csvFiles = await fetchCsvFiles();

    // Sort files by uploadTimestamp in descending order
    csvFiles.sort((a, b) => new Date(b.uploadTimestamp) - new Date(a.uploadTimestamp));

    csvFiles.forEach(file => {
      const row = document.createElement('tr');
      row.innerHTML = `
  <td>${new Date(file.uploadTimestamp).toLocaleString()}</td>
  <td>${file.filename}</td>
  <td class="text-center"><a href="/downloadcsv?filename=${file.filename}" id="btn-download">Download</a></td>
`;
      tableBody.appendChild(row);
    });
  })();
});
// ======= End History Section =======



(function () {
  "use strict";

  /**
   * Easy selector helper function
   */
  const select = (el, all = false) => {
    el = el.trim()
    if (all) {
      return [...document.querySelectorAll(el)]
    } else {
      return document.querySelector(el)
    }
  }

  /**
   * Easy event listener function
   */
  const on = (type, el, listener, all = false) => {
    let selectEl = select(el, all)
    if (selectEl) {
      if (all) {
        selectEl.forEach(e => e.addEventListener(type, listener))
      } else {
        selectEl.addEventListener(type, listener)
      }
    }
  }

  /**
   * Easy on scroll event listener 
   */
  const onscroll = (el, listener) => {
    el.addEventListener('scroll', listener)
  }

  /**
   * Navbar links active state on scroll
   */
  let navbarlinks = select('#navbar .scrollto', true)
  const navbarlinksActive = () => {
    let position = window.scrollY + 200
    navbarlinks.forEach(navbarlink => {
      if (!navbarlink.hash) return
      let section = select(navbarlink.hash)
      if (!section) return
      if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
        navbarlink.classList.add('active')
      } else {
        navbarlink.classList.remove('active')
      }
    })
  }
  window.addEventListener('load', navbarlinksActive)
  onscroll(document, navbarlinksActive)

  /**
   * Scrolls to an element with header offset
   */
  const scrollto = (el) => {
    let header = select('#header')
    let offset = header.offsetHeight

    if (!header.classList.contains('header-scrolled')) {
      offset -= 16
    }

    let elementPos = select(el).offsetTop
    window.scrollTo({
      top: elementPos - offset,
      behavior: 'smooth'
    })
  }

  /**
   * Toggle .header-scrolled class to #header when page is scrolled
   */
  let selectHeader = select('#header')
  if (selectHeader) {
    const headerScrolled = () => {
      if (window.scrollY > 100) {
        selectHeader.classList.add('header-scrolled')
      } else {
        selectHeader.classList.remove('header-scrolled')
      }
    }
    window.addEventListener('load', headerScrolled)
    onscroll(document, headerScrolled)
  }

  /**
   * Mobile nav toggle
   */
  on('click', '.mobile-nav-toggle', function (e) {
    select('#navbar').classList.toggle('navbar-mobile')
    this.classList.toggle('bi-list')
    this.classList.toggle('bi-x')
  })

  /**
   * Mobile nav dropdowns activate
   */
  on('click', '.navbar .dropdown > a', function (e) {
    if (select('#navbar').classList.contains('navbar-mobile')) {
      e.preventDefault()
      this.nextElementSibling.classList.toggle('dropdown-active')
    }
  }, true)

  /**
   * Scrool with ofset on links with a class name .scrollto
   */
  on('click', '.scrollto', function (e) {
    if (select(this.hash)) {
      e.preventDefault()

      let navbar = select('#navbar')
      if (navbar.classList.contains('navbar-mobile')) {
        navbar.classList.remove('navbar-mobile')
        let navbarToggle = select('.mobile-nav-toggle')
        navbarToggle.classList.toggle('bi-list')
        navbarToggle.classList.toggle('bi-x')
      }
      scrollto(this.hash)
    }
  }, true)

  /**
   * Scroll with ofset on page load with hash links in the url
   */
  window.addEventListener('load', () => {
    if (window.location.hash) {
      if (select(window.location.hash)) {
        scrollto(window.location.hash)
      }
    }
  });

  /**
   * Preloader
   */
  let preloader = select('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.remove()
    });
  }

  /**
   * Testimonials slider
   */
  new Swiper('.testimonials-slider', {
    speed: 600,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false
    },
    slidesPerView: 'auto',
    pagination: {
      el: '.swiper-pagination',
      type: 'bullets',
      clickable: true
    },
    breakpoints: {
      320: {
        slidesPerView: 1,
        spaceBetween: 40
      },

      1200: {
        slidesPerView: 3,
        spaceBetween: 40
      }
    }
  });

  /**
   * Porfolio isotope and filter
   */
  window.addEventListener('load', () => {
    let portfolioContainer = select('.portfolio-container');
    if (portfolioContainer) {
      let portfolioIsotope = new Isotope(portfolioContainer, {
        itemSelector: '.portfolio-item'
      });

      let portfolioFilters = select('#portfolio-flters li', true);

      on('click', '#portfolio-flters li', function (e) {
        e.preventDefault();
        portfolioFilters.forEach(function (el) {
          el.classList.remove('filter-active');
        });
        this.classList.add('filter-active');

        portfolioIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        portfolioIsotope.on('arrangeComplete', function () {
          AOS.refresh()
        });
      }, true);
    }

  });

  /**
   * Initiate portfolio lightbox 
   */
  const portfolioLightbox = GLightbox({
    selector: '.portfolio-lightbox'
  });

  /**
   * Portfolio details slider
   */
  new Swiper('.portfolio-details-slider', {
    speed: 400,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false
    },
    pagination: {
      el: '.swiper-pagination',
      type: 'bullets',
      clickable: true
    }
  });

  /**
   * Animation on scroll
   */
  window.addEventListener('load', () => {
    AOS.init({
      duration: 1000,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    })
  });

  /**
   * Initiate Pure Counter 
   */
  new PureCounter();

})()