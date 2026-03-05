function updateItem(/* item, index */) {

}

function update(fieldset) {
  const items = [...fieldset.children].filter((item) => item.tagName === 'FIELDSET');
  items.forEach((item, index) => {
    // update item name and legend for each item based on index.
    updateItem(item, index);
  });
}

function createButton(fd) {
  const button = document.createElement('button');
  button.className = `${fd.Name}-${fd.Label} fieldset-${fd.Label}`;
  button.textContent = fd.Label.charAt(0).toUpperCase() + fd.Label.slice(1);
  button.type = 'button';
  return button;
}

function createItem(fieldset, removable = true) {
  const item = document.createElement('fieldset');
  item.innerHTML = fieldset.elements['#template'].innerHTML;
  if (removable) {
    const button = createButton({ Label: 'remove', Name: fieldset.name });
    button.onclick = () => {
      item.remove();
      update(fieldset);
    };
    item.append(button);
  }
  return item;
}

function validateMin(fieldset) {
  const min = parseInt(fieldset.getAttribute('min') || -1, 10);
  for (let i = 0; i < min; i += 1) {
    fieldset.insertBefore(createItem(fieldset, false), fieldset.elements['#add']);
  }
  update(fieldset);
}

export default async function decorate(form) {
  [...form.querySelectorAll('fieldset[data-repeatable=true]')].forEach((fieldset) => {
    fieldset.elements['#template'] = document.createElement('div');
    fieldset.elements['#add'] = fieldset.querySelector('button') || createButton({ Label: 'add', Name: fieldset.name });
    fieldset.elements['#add'].remove(); // remove add button from template
    fieldset.elements['#template'].innerHTML = fieldset.innerHTML;
    fieldset.elements['#add'].onclick = () => {
      fieldset.insertBefore(createItem(fieldset), fieldset.elements['#add']);
      update(fieldset);
    };
    fieldset.replaceChildren(fieldset.elements['#add']);
    validateMin(fieldset);
  });
}

const formWrapper = document.querySelector(".test-drive-form div:nth-child(4)");
const newDiv = document.createElement("div");
newDiv.classList.add("columns-wrapper");
newDiv.innerHTML = `
  <div class="columns testdrive-formtext block columns-1-cols" data-block-name="columns" data-block-status="loaded">
    <div>
      <div>
        <p>
          <span class="icon icon-icon-img-dsc-062">
            <svg xmlns="http://www.w3.org/2000/svg">
              <use href="#icons-sprite-icon-img-dsc-062"></use>
            </svg>
          </span>Contact Details
        </p>
      </div>
    </div>
  </div>
`;

// Insert the new div under the "form-wrapper"
if (formWrapper) formWrapper.insertBefore(newDiv, formWrapper.firstChild);