if ( typeof CartForm !== 'function' ) {
	class CartForm extends HTMLElement {

		constructor(){
			super();
			this.ajaxifyCartItems();
		}

		ajaxifyCartItems(){

			this.form = this.querySelector('form');

			this.querySelectorAll('[data-js-cart-item]').forEach(item=>{

				const remove = item.querySelector('.remove');
				if ( remove ) {
					remove.dataset.href = remove.getAttribute('href');
					remove.setAttribute('href', '');
					remove.addEventListener('click', (e)=>{
						e.preventDefault();
						this.updateCartQty(item, 0);
					})
				}

				const qty = item.querySelector('.qty');
				if ( qty ) {
					qty.addEventListener('input', debounce(e=>{
						e.preventDefault();
						e.target.blur();
						this.updateCartQty(item, parseInt(qty.value));
					}, 500));
					qty.addEventListener('click', (e)=>{
						e.target.select();
					})
				}

			})

		}

		updateCartQty(item, newQty){

			let alert = null;

			this.form.classList.add('processing');
			if ( this.querySelector('.alert') ) {
				this.querySelector('.alert').remove();
			}

			const body = JSON.stringify({
				line: parseInt(item.dataset.line),
				quantity: newQty
			});

			fetch(KROWN.settings.routes.cart_change_url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Accept': 'application/javascript' },
					body
				})
				.then(response => response.json())
				.then(response => {
					if ( response.status == 422 ) {
						// wrong stock logic alert
						alert = document.createElement('span');
						alert.classList.add('alert', 'alert--error');
						if ( typeof response.description === 'string' ) {
							alert.innerHTML = response.description;
						} else {
							alert.innerHTML = response.message;
						}
					}
					return fetch('?section_id=helper-cart');
				})
				.then(response => response.text())
				.then(text => {

					const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');
					const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
					const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

					const cartItems = document.getElementById('AjaxCartForm');
					cartItems.innerHTML = cartFormInnerHTML;
					cartItems.ajaxifyCartItems();

					document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
						elm.textContent = cartItems.querySelector('[data-cart-count]').textContent;
					});
					document.querySelectorAll('[data-header-cart-total]').forEach(elm=>{
						elm.textContent = cartItems.querySelector('[data-cart-total]').textContent;
					});

					if ( alert !== null ) {
						this.form.prepend(alert);
					} 

					document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;
							
					const event = new Event('cart-updated');
					this.dispatchEvent(event);

				})
				.catch(e => {
					console.log(e);
					let alert = document.createElement('span');
					alert.classList.add('alert', 'alert--error');
					alert.textContent = KROWN.settings.locales.cart_general_error;
					this.form.prepend(alert);
				})
				.finally(() => {
					this.form.classList.remove('processing');
				});
		}

	} 


  if ( typeof customElements.get('cart-form') == 'undefined' ) {
		customElements.define('cart-form', CartForm);
	}

}

if ( typeof CartProductQuantity !== 'function' ) {

	class CartProductQuantity extends HTMLElement {
		constructor(){
			super();
			this.querySelector('.qty-minus').addEventListener('click', this.changeCartInput.bind(this));
			this.querySelector('.qty-plus').addEventListener('click', this.changeCartInput.bind(this));
		}
		changeCartInput(){
			setTimeout(()=>{
				document.getElementById('AjaxCartForm').updateCartQty(this.closest('[data-js-cart-item]'), parseInt(this.querySelector('.qty').value));
			}, 50);
		}
	}

  if ( typeof customElements.get('cart-product-quantity') == 'undefined' ) {
		customElements.define('cart-product-quantity', CartProductQuantity);
	}

}

// method for apps to tap into and refresh the cart

if ( ! window.refreshCart ) {

	window.refreshCart = () => {
		
		fetch('?section_id=helper-cart')
			.then(response => response.text())
			.then(text => {

			const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');
			const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
			const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

			const cartItems = document.getElementById('AjaxCartForm');
			cartItems.innerHTML = cartFormInnerHTML;
			cartItems.ajaxifyCartItems();

			document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
				elm.textContent = cartItems.querySelector('[data-cart-count]').textContent;
			});
			document.querySelectorAll('[data-header-cart-total').forEach(elm=>{
				elm.textContent = cartItems.querySelector('[data-cart-total]').textContent;
			})
			
			document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;
			if ( document.querySelector('[data-js-site-cart-sidebar]') ) {
				document.querySelector('[data-js-site-cart-sidebar]').show();
			}

			if ( document.querySelector('cart-recommendations') ) {
				document.querySelector('cart-recommendations').innerHTML = '';
				document.querySelector('cart-recommendations').generateRecommendations();
			}

		})

	}

}

if ( ! customElements.get('cart-note') ) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();
        this.addEventListener(
          'input',
          debounce(event => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${KROWN.settings.routes.cart_update_url}`, { 
							method: 'POST',
							headers: { 'Content-Type': 'application/json', 'Accept': 'application/javascript' },
							body 
						});
		  		}, 150)
				);
      }
    }
  );
}

if ( ! customElements.get('cart-discounts' ) ) {
	customElements.define(
		'cart-discounts',
		class CartDiscounts extends HTMLElement {

			constructor() {
				super();

				const button = this.querySelector('[data-js-discount-submit]');
				this.input = this.querySelector('[data-js-discount-input]');
				this.cartSubtotal = document.getElementById('AjaxCartSubtotal');
				this.cartDiscountError = this.querySelector('[data-js-discount-error]');
				this.discountCodes = document.querySelector('[data-js-discount-codes]');

				this.loadDiscountButtons();

				button.addEventListener('click', (e) => {
					e.preventDefault();
					if ( this.input.value.length > 0 ) {

						this.cartSubtotal.classList.add('processing');
						if (this.discountCodes) {
							this.discountCodes.classList.add('processing');
						}

						const existingDiscounts = Array.from(this.querySelectorAll('[data-js-discount]')).map(elm => elm.dataset.jsDiscount);
						
						const allDiscounts = [...existingDiscounts, this.input.value];
						const discountString = allDiscounts.join(',');
						const body = JSON.stringify({ discount: discountString });

						fetch(`${KROWN.settings.routes.cart_update_url}`, { 
							method: 'POST',
							headers: { 'Content-Type': 'application/json', 'Accept': 'application/javascript' },
							body 
						})
							.then(response => response.json())
							.then(response => {
								const discountCodes = response.discount_codes;
								const inputValue = this.input.value;
								const matchingCode = discountCodes.find(code => 
									code.code === inputValue
								);

								if (matchingCode) {
									if (matchingCode.applicable) {
										this.handleSuccess();
									} else {
										this.handleError();
									}
								} else {
									this.handleError();
								}
							})
							.catch(error => {
								this.handleError();
								console.log(`Error: ${error}`);
							})

					}

				});

			}

			handleSuccess(){
				fetch('?section_id=helper-cart')
					.then(response => response.text())
					.then(text => {
						const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');
						const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;
						this.cartSubtotal.innerHTML = cartSubtotalInnerHTML;
						this.cartSubtotal.classList.remove('processing');
						this.cartDiscountError.innerHTML = '';
						if ( sectionInnerHTML.querySelector('[data-js-discount-codes]') ) {
							this.discountCodes.innerHTML = sectionInnerHTML.querySelector('[data-js-discount-codes]').innerHTML;
							this.discountCodes.classList.remove('processing');
							this.loadDiscountButtons();
						}
						this.input.value = '';
					})
			}

			loadDiscountButtons(){
				this.querySelectorAll('[data-js-discount]').forEach(elm=>{
					if ( ! elm.classList.contains('enabled') ) {
						elm.classList.add('enabled');
						elm.addEventListener('click', (e)=>{
							e.preventDefault();
							this.cartSubtotal.classList.add('processing');
							if (this.discountCodes) {
								this.discountCodes.classList.add('processing');
							}
							const discountToRemove = elm.dataset.jsDiscount;
							
							const allDiscountElements = this.querySelectorAll('[data-js-discount]');
							const allDiscounts = Array.from(allDiscountElements).map(el => el.dataset.jsDiscount);
							
							const remainingDiscounts = allDiscounts.filter(discount => discount !== discountToRemove);
							
							const body = JSON.stringify({ 
								discount: remainingDiscounts.join(',') 
							});
							
							fetch(`${KROWN.settings.routes.cart_update_url}`, { 
								method: 'POST',
								headers: { 'Content-Type': 'application/json', 'Accept': 'application/javascript' },
								body 
							})
								.then(() => {
									this.handleSuccess();
								})
								.catch(error => {
									console.error(`Error: ${error}`);
								});
						});
					}
				});
			}
			
			handleError(){
				this.cartSubtotal.classList.remove('processing');
				if (this.discountCodes) {
					this.discountCodes.classList.remove('processing');
				}
				this.cartDiscountError.innerHTML = window.KROWN.settings.locales.cart_discount_code_error;
			}

		}	
	)
}