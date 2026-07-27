import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';
import './styles.css';

const statusLabels = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  riderAssigned: 'Rider assigned',
  onTheWay: 'On the way',
  delivered: 'Delivered',
  rejected: 'Rejected',
};

const statusTone = {
  pending: 'warn',
  accepted: 'info',
  preparing: 'info',
  riderAssigned: 'info',
  onTheWay: 'info',
  delivered: 'success',
  rejected: 'danger',
};

const terminalStatuses = new Set(['delivered', 'rejected']);

const categories = ['food', 'medicine', 'others'];
const restaurantsPerPage = 7;

const blankMenuItem = () => ({
  name: '',
  description: '',
  price: '',
  tag: 'Item',
  category: 'food',
});

const blankRestaurant = () => ({
  name: '',
  cuisine: '',
  rating: '4.5',
  minutes: '25',
  deliveryFee: '40',
  colorHex: '#FFE7A3',
  menu: [blankMenuItem()],
});

const blankSignIn = { phone: '', password: '' };
const blankSignUp = { name: '', phone: '', password: '' };

function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }, [key, value]);

  return [value, setValue];
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function colorToCss(value) {
  const normalized = String(value || '#FFE7A3').trim();
  if (normalized.startsWith('0x')) {
    return `#${normalized.slice(4)}`;
  }
  return normalized;
}

function statusClass(status) {
  return `status status-${statusTone[status] || 'info'}`;
}

function normalizeOrderPayload(payload) {
  if (Array.isArray(payload?.order)) {
    return payload.order[0] || null;
  }
  if (payload?.order && typeof payload.order === 'object') {
    return payload.order;
  }
  if (Array.isArray(payload?.orders)) {
    return payload.orders[0] || null;
  }
  return null;
}

function normalizeOrders(value) {
  return Array.isArray(value) ? value.filter((order) => order && typeof order === 'object') : [];
}

function App() {
  const [session, setSession] = useLocalStorageState('kds-react-session', null);
  const [cart, setCart] = useLocalStorageState('kds-react-cart', {
    restaurantId: null,
    restaurantName: '',
    deliveryFee: 0,
    items: [],
  });
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authOpen, setAuthOpen] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authFieldErrors, setAuthFieldErrors] = useState({});
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [signInForm, setSignInForm] = useState(blankSignIn);
  const [signUpForm, setSignUpForm] = useState(blankSignUp);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutErrors, setCheckoutErrors] = useState({});
  const [restaurantForm, setRestaurantForm] = useState(blankRestaurant());
  const [restaurantErrors, setRestaurantErrors] = useState({ menu: [] });
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);
  const [restaurantPage, setRestaurantPage] = useState(1);
  const [orderDrafts, setOrderDrafts] = useState({});
  const [orderView, setOrderView] = useState('all');
  const [panel, setPanel] = useState('browse');

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) || null,
    [restaurants, selectedRestaurantId],
  );

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return restaurants;
    }
    return restaurants.filter((restaurant) => {
      const haystack = [restaurant.name, restaurant.cuisine, ...(restaurant.menu || []).map((item) => item.name)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [restaurants, search]);

  const restaurantPageCount = Math.max(1, Math.ceil(restaurants.length / restaurantsPerPage));
  const pagedRestaurants = restaurants.slice(
    (restaurantPage - 1) * restaurantsPerPage,
    restaurantPage * restaurantsPerPage,
  );
  const normalizedOrders = normalizeOrders(orders);
  const todayOrders = normalizedOrders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    const today = new Date();
    return (
      createdAt.getFullYear() === today.getFullYear() &&
      createdAt.getMonth() === today.getMonth() &&
      createdAt.getDate() === today.getDate()
    );
  });
  const visibleOrders = orderView === 'today' ? todayOrders : normalizedOrders;

  const cartSubtotal = cart.items.reduce((sum, entry) => sum + Number(entry.item.price) * entry.quantity, 0);
  const cartDeliveryFee = Number(cart.deliveryFee || 0);
  const cartTotal = cartSubtotal + cartDeliveryFee;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const restaurantsPayload = await api.getRestaurants();
        if (!active) {
          return;
        }
        setRestaurants(restaurantsPayload.restaurants || []);
        if (session?.token) {
          const ordersPayload = await api.getOrders(session.token);
          if (!active) {
            return;
          }
          setOrders(normalizeOrders(ordersPayload.orders));
        } else {
          setOrders([]);
        }
        if (!selectedRestaurantId && restaurantsPayload.restaurants?.length) {
          setSelectedRestaurantId(restaurantsPayload.restaurants[0].id);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [session?.token]);

  useEffect(() => {
    if (session?.user) {
      setCheckoutName(session.user.name || '');
      setCheckoutPhone(session.user.phone || '');
    }
  }, [session?.user]);

  useEffect(() => {
    if (session?.user?.role === 'admin' && panel === 'browse') {
      setPanel('orders');
    }
    if (session?.user?.role === 'customer' && panel === 'admin') {
      setPanel('browse');
    }
  }, [panel, session?.user?.role]);

  useEffect(() => {
    if (!restaurants.length) {
      return;
    }
    const stillExists = restaurants.some((restaurant) => restaurant.id === selectedRestaurantId);
    if (!stillExists) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  useEffect(() => {
    if (restaurantPage > restaurantPageCount) {
      setRestaurantPage(restaurantPageCount);
    }
  }, [restaurantPage, restaurantPageCount]);

  function notify(type, message) {
    if (type === 'success') {
      setSuccess(message);
      setError('');
    } else {
      setError(message);
      setSuccess('');
    }
  }

  function clearNotifications() {
    setError('');
    setSuccess('');
  }

  function clearAuthErrors() {
    setAuthError('');
    setAuthFieldErrors({});
  }

  function classifyAuthErrors(message, mode) {
    const normalized = String(message || '').toLowerCase();
    const nextErrors = {};

    if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('number')) {
      nextErrors.phone = message;
    }

    if (normalized.includes('password') || normalized.includes('credential') || normalized.includes('invalid')) {
      if (mode === 'signup' && normalized.includes('name')) {
        nextErrors.name = message;
      } else {
        nextErrors.password = message;
      }
    }

    if (mode === 'signup') {
      if (normalized.includes('name')) {
        nextErrors.name = message;
      }
      if (normalized.includes('password') && !nextErrors.password) {
        nextErrors.password = message;
      }
    }

    return nextErrors;
  }

  function setCheckoutField(field, value) {
    if (field === 'name') {
      setCheckoutName(value);
    }
    if (field === 'phone') {
      setCheckoutPhone(value);
    }
    if (field === 'address') {
      setCheckoutAddress(value);
    }
    setCheckoutErrors((current) => ({ ...current, [field]: '' }));
  }

  function validateCheckout() {
    const nextErrors = {};
    const phone = checkoutPhone.trim();

    if (!checkoutName.trim()) {
      nextErrors.name = 'Enter the customer name.';
    }
    if (!phone) {
      nextErrors.phone = 'Enter a mobile number.';
    } else if (!/^01[3-9]\d{8}$/.test(phone)) {
      nextErrors.phone = 'Enter a valid Bangladesh mobile number.';
    }
    if (!checkoutAddress.trim()) {
      nextErrors.address = 'Enter a delivery address.';
    }

    setCheckoutErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function reloadData(token = session?.token) {
    clearNotifications();
    try {
      const restaurantsPayload = await api.getRestaurants();
      setRestaurants(restaurantsPayload.restaurants || []);
      if (token) {
        const ordersPayload = await api.getOrders(token);
        setOrders(normalizeOrders(ordersPayload.orders));
      }
    } catch (err) {
      notify('error', err.message);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    clearNotifications();
    clearAuthErrors();
    setBusy(true);
    try {
      const payload = await api.signIn(signInForm.phone, signInForm.password);
      setSession(payload);
      setSignInForm(blankSignIn);
      setAuthMode('signin');
      setAuthOpen(false);
      setPanel(payload.user.role === 'admin' ? 'orders' : 'browse');
      await reloadData(payload.token);
      notify('success', 'Signed in successfully.');
    } catch (err) {
      setAuthError(err.message);
      setAuthFieldErrors(classifyAuthErrors(err.message, 'signin'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    clearNotifications();
    clearAuthErrors();
    setBusy(true);
    try {
      const payload = await api.signUp(signUpForm.name, signUpForm.phone, signUpForm.password);
      setSession(payload);
      setSignUpForm(blankSignUp);
      setAuthMode('signin');
      setAuthOpen(false);
      setPanel('browse');
      await reloadData(payload.token);
      notify('success', 'Account created.');
    } catch (err) {
      setAuthError(err.message);
      setAuthFieldErrors(classifyAuthErrors(err.message, 'signup'));
    } finally {
      setBusy(false);
    }
  }

  function clearSessionState() {
    setSession(null);
    setOrders([]);
    setCart({
      restaurantId: null,
      restaurantName: '',
      deliveryFee: 0,
      items: [],
    });
    setPanel('browse');
    setSuccess('');
    setError('');
    setAuthOpen(false);
    setAuthMode('signin');
    setBusy(false);
  }

  function openLogoutConfirm() {
    setLogoutOpen(true);
  }

  function cancelLogout() {
    if (logoutBusy) {
      return;
    }
    setLogoutOpen(false);
  }

  function handleLogout() {
    setLogoutBusy(true);
    setBusy(true);
    window.setTimeout(() => {
      clearSessionState();
      setLogoutBusy(false);
      setLogoutOpen(false);
    }, 450);
  }

  function handleAddToCart(restaurant, item) {
    clearNotifications();
    const isDifferentRestaurant = cart.restaurantId && cart.restaurantId !== restaurant.id;
    if (isDifferentRestaurant) {
      const confirmed = window.confirm('Replace the current cart with this restaurant?');
      if (!confirmed) {
        return;
      }
    }

    setCart((current) => {
      const existingItems = isDifferentRestaurant ? [] : current.items;
      const existingIndex = existingItems.findIndex((entry) => entry.item.name === item.name);
      const nextItems = existingIndex >= 0
        ? existingItems.map((entry, index) =>
            index === existingIndex ? { ...entry, quantity: entry.quantity + 1 } : entry,
          )
        : [...existingItems, { item, quantity: 1 }];

      return {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        deliveryFee: restaurant.deliveryFee,
        items: nextItems,
      };
    });
    setSelectedRestaurantId(restaurant.id);
  }

  function updateCartQuantity(itemName, delta) {
    setCart((current) => {
      const items = current.items
        .map((entry) =>
          entry.item.name === itemName ? { ...entry, quantity: entry.quantity + delta } : entry,
        )
        .filter((entry) => entry.quantity > 0);
      if (items.length === 0) {
        return {
          restaurantId: null,
          restaurantName: '',
          deliveryFee: 0,
          items: [],
        };
      }
      return { ...current, items };
    });
  }

  async function handleCheckout(event) {
    event.preventDefault();
    clearNotifications();
    if (!session?.token) {
      notify('error', 'Sign in before placing an order.');
      return;
    }
    if (!cart.items.length) {
      notify('error', 'Your cart is empty.');
      return;
    }
    if (!validateCheckout()) {
      return;
    }

    setBusy(true);
    try {
      const payload = await api.createOrder(session.token, {
        restaurantName: cart.restaurantName,
        customerName: checkoutName.trim(),
        phone: checkoutPhone.trim(),
        address: checkoutAddress.trim(),
        subtotal: cartSubtotal,
        deliveryFee: cartDeliveryFee,
        lines: cart.items.map((entry) => ({
          quantity: entry.quantity,
          item: entry.item,
        })),
      });

      const createdOrder = normalizeOrderPayload(payload);
      if (!createdOrder) {
        throw new Error('Order was created, but the server returned an invalid order response.');
      }

      setOrders((current) => [createdOrder, ...normalizeOrders(current)]);
      setCart({
        restaurantId: null,
        restaurantName: '',
        deliveryFee: 0,
        items: [],
      });
      setCheckoutAddress('');
      setCheckoutErrors({});
      setPanel('orders');
      notify('success', 'Order placed successfully.');
      await reloadData();
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  function setRestaurantField(field, value) {
    setRestaurantForm((current) => ({ ...current, [field]: value }));
    setRestaurantErrors((current) => ({ ...current, [field]: '' }));
  }

  function setMenuField(index, field, value) {
    setRestaurantForm((current) => {
      const menu = current.menu.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      );
      return { ...current, menu };
    });
    setRestaurantErrors((current) => {
      const menu = [...(current.menu || [])];
      menu[index] = { ...(menu[index] || {}), [field]: '' };
      return { ...current, menu };
    });
  }

  function addMenuRow() {
    setRestaurantForm((current) => ({ ...current, menu: [...current.menu, blankMenuItem()] }));
    setRestaurantErrors((current) => ({ ...current, menu: [...(current.menu || []), {}] }));
  }

  function removeMenuRow(index) {
    setRestaurantForm((current) => {
      const menu = current.menu.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, menu: menu.length ? menu : [blankMenuItem()] };
    });
    setRestaurantErrors((current) => {
      const menu = (current.menu || []).filter((_, itemIndex) => itemIndex !== index);
      return { ...current, menu: menu.length ? menu : [{}] };
    });
  }

  function validateRestaurantForm() {
    const nextErrors = { menu: restaurantForm.menu.map(() => ({})) };

    if (!restaurantForm.name.trim()) {
      nextErrors.name = 'Enter restaurant name.';
    }
    if (!restaurantForm.cuisine.trim()) {
      nextErrors.cuisine = 'Enter cuisine.';
    }
    if (!restaurantForm.rating || Number(restaurantForm.rating) <= 0) {
      nextErrors.rating = 'Enter a valid rating.';
    }
    if (!restaurantForm.minutes || Number(restaurantForm.minutes) <= 0) {
      nextErrors.minutes = 'Enter delivery minutes.';
    }
    if (!restaurantForm.deliveryFee || Number(restaurantForm.deliveryFee) < 0) {
      nextErrors.deliveryFee = 'Enter a valid delivery fee.';
    }
    if (restaurantForm.colorHex.trim() && !/^(#|0x)[0-9a-fA-F]{6,8}$/.test(restaurantForm.colorHex.trim())) {
      nextErrors.colorHex = 'Use a valid color like #FFE7A3.';
    }

    restaurantForm.menu.forEach((item, index) => {
      if (!item.name.trim()) {
        nextErrors.menu[index].name = 'Enter item name.';
      }
      if (!item.description.trim()) {
        nextErrors.menu[index].description = 'Enter item description.';
      }
      if (!item.price || Number(item.price) <= 0) {
        nextErrors.menu[index].price = 'Enter item price.';
      }
      if (!item.tag.trim()) {
        nextErrors.menu[index].tag = 'Enter item tag.';
      }
    });

    const hasMenuErrors = nextErrors.menu.some((item) => Object.values(item).some(Boolean));
    const hasFormErrors = Object.entries(nextErrors).some(
      ([field, value]) => field !== 'menu' && Boolean(value),
    );

    setRestaurantErrors(nextErrors);
    return !hasFormErrors && !hasMenuErrors;
  }

  function openRestaurantEditor(restaurant) {
    setEditingRestaurantId(restaurant.id);
    setRestaurantForm({
      name: restaurant.name || '',
      cuisine: restaurant.cuisine || '',
      rating: String(restaurant.rating ?? 4.5),
      minutes: String(restaurant.minutes ?? 25),
      deliveryFee: String(restaurant.deliveryFee ?? 40),
      colorHex: colorToCss(restaurant.colorHex),
      menu: (restaurant.menu || []).length
        ? restaurant.menu.map((item) => ({
            name: item.name || '',
            description: item.description || '',
            price: String(item.price ?? ''),
            tag: item.tag || 'Item',
            category: item.category || 'food',
          }))
        : [blankMenuItem()],
    });
    setPanel('admin');
    setRestaurantErrors({
      menu: (restaurant.menu || []).length ? restaurant.menu.map(() => ({})) : [{}],
    });
  }

  function resetRestaurantForm() {
    setEditingRestaurantId(null);
    setRestaurantForm(blankRestaurant());
    setRestaurantErrors({ menu: [{}] });
  }

  async function handleRestaurantSubmit(event) {
    event.preventDefault();
    if (!session?.token) {
      notify('error', 'Sign in as admin first.');
      return;
    }
    clearNotifications();
    if (!validateRestaurantForm()) {
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: restaurantForm.name.trim(),
        cuisine: restaurantForm.cuisine.trim(),
        rating: Number(restaurantForm.rating || 4.5),
        minutes: Number(restaurantForm.minutes || 25),
        deliveryFee: Number(restaurantForm.deliveryFee || 40),
        colorHex: restaurantForm.colorHex.trim() || '#FFE7A3',
        menu: restaurantForm.menu
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name.trim(),
            description: item.description.trim(),
            price: Number(item.price || 0),
            tag: item.tag.trim() || 'Item',
            category: item.category,
          })),
      };

      if (payload.menu.length === 0) {
        throw new Error('Add at least one menu item.');
      }

      if (editingRestaurantId) {
        await api.updateRestaurant(session.token, editingRestaurantId, payload);
      } else {
        await api.createRestaurant(session.token, payload);
      }

      await reloadData();
      resetRestaurantForm();
      notify('success', editingRestaurantId ? 'Restaurant updated.' : 'Restaurant created.');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusSave(orderCode) {
    const draft = orderDrafts[orderCode] || {};
    const order = normalizeOrders(orders).find((entry) => entry.id === orderCode);
    if (terminalStatuses.has(order?.status)) {
      return;
    }
    const status = draft.status || order?.status;
    if (!status) {
      return;
    }
    clearNotifications();
    setBusy(true);
    try {
      await api.updateOrderStatus(session.token, orderCode, {
        status,
        riderName: draft.riderName?.trim() || null,
      });
      await reloadData();
      notify('success', `Updated ${orderCode}.`);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRestaurant(restaurant) {
    if (!session?.token) {
      notify('error', 'Sign in as admin first.');
      return;
    }
    const confirmed = window.confirm(`Delete ${restaurant.name}?`);
    if (!confirmed) {
      return;
    }

    clearNotifications();
    setBusy(true);
    try {
      await api.deleteRestaurant(session.token, restaurant.id);
      if (editingRestaurantId === restaurant.id) {
        resetRestaurantForm();
      }
      await reloadData();
      notify('success', 'Restaurant deleted.');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedMenuItems = selectedRestaurant?.menu || [];
  const isAdmin = session?.user?.role === 'admin';

  function openAuth(mode = 'signin') {
    clearAuthErrors();
    setAuthMode(mode);
    setAuthOpen(true);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img
            alt="KD Easy Life logo"
            className="brand-logo"
            src="/kd-easy-life-logo.jpeg"
          />
          <div>
            <div className="eyebrow">KD Easy Life</div>
            <h1>Food Delivery</h1>
          </div>
        </div>
        <div className="topbar-actions">
          {session?.user ? (
            <>
              <div className="user-pill">
                <strong>{session.user.name}</strong>
                <span>{session.user.role}</span>
              </div>
              <button className="button button-ghost" onClick={openLogoutConfirm} type="button">
                Logout
              </button>
            </>
          ) : null}
          {!session?.user ? (
            <button className="button button-primary" type="button" onClick={() => openAuth('signin')}>
              Login
            </button>
          ) : null}
        </div>
      </header>

      <main className="layout">
        <section className="hero panel">
          <div className="hero-copy">
            <p className="eyebrow">Browser frontend for the existing Node API</p>
            <h2>Hot meals, fast delivery, and checkout in just a few taps.</h2>
            <p>
              Browse restaurants, add meals to your cart, and place orders from one clean food-delivery
              dashboard.
            </p>
            <div className="hero-search">
              <label>
                Search restaurants or menu items
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Biryani, burger, soup..."
                />
              </label>
            </div>
            <div className="hero-stats">
              <div>
                <strong>{restaurants.length}</strong>
                <span>restaurants</span>
              </div>
              <div>
                <strong>{normalizeOrders(orders).length}</strong>
                <span>orders</span>
              </div>
              <div>
                <strong>{cart.items.length}</strong>
                <span>cart items</span>
              </div>
            </div>
          </div>
          <div className="hero-scene" aria-hidden="true">
            <div className="scene-card scene-banner">
              <span>Fresh table</span>
              <strong>Warm food, quick service</strong>
            </div>
            <div className="scene-plate scene-plate-large">
              <div className="scene-bowl"></div>
              <div className="scene-garnish scene-garnish-one"></div>
              <div className="scene-garnish scene-garnish-two"></div>
            </div>
            <div className="scene-plate scene-plate-small"></div>
            <div className="scene-cutlery scene-cutlery-left"></div>
            <div className="scene-cutlery scene-cutlery-right"></div>
            <div className="scene-steam scene-steam-one"></div>
            <div className="scene-steam scene-steam-two"></div>
            <div className="scene-mat"></div>
          </div>
        </section>

        <section className="nav-panel panel">
          <div className="toolbar-actions">
            {!session?.user || !isAdmin ? (
              <>
                <button
                  className={panel === 'browse' ? 'button button-primary' : 'button button-ghost'}
                  type="button"
                  onClick={() => setPanel('browse')}
                >
                  Restaurants
                </button>
               
                  <button
                    className={panel === 'cart' ? 'button button-primary' : 'button button-ghost'}
                    type="button"
                    onClick={() => setPanel('cart')}
                  >
                    Cart
                  </button>
               
              </>
            ) : null}
            {session?.user ? (
              <button
                className={panel === 'orders' ? 'button button-primary' : 'button button-ghost'}
                type="button"
                onClick={() => setPanel('orders')}
              >
                Orders
              </button>
            ) : null}
            {isAdmin ? (
              <button
                className={panel === 'admin' ? 'button button-primary' : 'button button-ghost'}
                type="button"
                onClick={() => setPanel('admin')}
              >
                Restaurant
              </button>
            ) : null}
          </div>
        </section>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {success ? <div className="alert alert-success">{success}</div> : null}
        {loading ? <div className="panel loading">Loading data from the API...</div> : null}

        {panel === 'browse' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Restaurants</p>
                  <h3>Choose a place and build your cart</h3>
                </div>
                <span className="muted">Click a card to inspect the menu</span>
              </div>

              <div className="cards-grid">
                {filteredRestaurants.map((restaurant) => (
                  <button
                    className={`restaurant-card ${selectedRestaurantId === restaurant.id ? 'active' : ''}`}
                    key={restaurant.id}
                    type="button"
                    onClick={() => setSelectedRestaurantId(restaurant.id)}
                    style={{ background: colorToCss(restaurant.colorHex) }}
                  >
                    <div className="restaurant-card-top">
                      <strong>{restaurant.name}</strong>
                      <span>{restaurant.cuisine}</span>
                    </div>
                    <div className="restaurant-meta">
                      <span>{restaurant.rating} rating</span>
                      <span>{restaurant.minutes} min</span>
                      <span>{formatMoney(restaurant.deliveryFee)} delivery</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Menu</p>
                  <h3>{selectedRestaurant ? selectedRestaurant.name : 'Select a restaurant'}</h3>
                </div>
                <span className="muted">{selectedMenuItems.length} items</span>
              </div>

              {selectedRestaurant ? (
                <div className="menu-list">
                  {selectedMenuItems.map((item) => (
                    <article className="menu-item" key={`${selectedRestaurant.id}-${item.name}`}>
                      <div>
                        <div className="menu-item-head">
                          <strong>{item.name}</strong>
                          <span className="tag">{item.tag}</span>
                        </div>
                        <p>{item.description}</p>
                      </div>
                      <div className="menu-item-actions">
                        <strong>{formatMoney(item.price)}</strong>
                        <button
                          className="button button-primary"
                          type="button"
                          onClick={() => handleAddToCart(selectedRestaurant, item)}
                        >
                          Add
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Pick a restaurant from the list.</div>
              )}
            </div>
          </section>
        ) : null}

        {panel === 'cart'  && !isAdmin ? (
          <section className="content-single">
            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Cart</p>
                  <h3>Review and place your order</h3>
                </div>
                <span className="muted">
                  {cart.items.length ? `${cart.items.length} items` : 'Cart empty'}
                </span>
              </div>

              <div className="cart-box">
                {cart.items.map((entry) => (
                  <div className="cart-line" key={entry.item.name}>
                    <div>
                      <strong>{entry.item.name}</strong>
                      <p>{formatMoney(entry.item.price)}</p>
                    </div>
                    <div className="quantity-controls">
                      <button type="button" onClick={() => updateCartQuantity(entry.item.name, -1)}>
                        -
                      </button>
                      <span>{entry.quantity}</span>
                      <button type="button" onClick={() => updateCartQuantity(entry.item.name, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                ))}

                {cart.items.length === 0 ? (
                  <div className="empty-state">Add menu items from Restaurants before placing an order.</div>
                ) : null}

                <form className="stack" onSubmit={handleCheckout}>
                  <label>
                    Customer name
                    <input
                      aria-invalid={checkoutErrors.name ? 'true' : 'false'}
                      value={checkoutName}
                      onChange={(event) => setCheckoutField('name', event.target.value)}
                    />
                    {checkoutErrors.name ? <span className="field-error">{checkoutErrors.name}</span> : null}
                  </label>
                  <label>
                    Phone
                    <input
                      aria-invalid={checkoutErrors.phone ? 'true' : 'false'}
                      value={checkoutPhone}
                      onChange={(event) => setCheckoutField('phone', event.target.value)}
                    />
                    {checkoutErrors.phone ? <span className="field-error">{checkoutErrors.phone}</span> : null}
                  </label>
                  <label>
                    Address
                    <textarea
                      aria-invalid={checkoutErrors.address ? 'true' : 'false'}
                      rows="4"
                      value={checkoutAddress}
                      onChange={(event) => setCheckoutField('address', event.target.value)}
                      placeholder="House, road, area"
                    />
                    {checkoutErrors.address ? <span className="field-error">{checkoutErrors.address}</span> : null}
                  </label>

                  <div className="summary">
                    <div>
                      <span>Subtotal</span>
                      <strong>{formatMoney(cartSubtotal)}</strong>
                    </div>
                    <div>
                      <span>Delivery</span>
                      <strong>{formatMoney(cartDeliveryFee)}</strong>
                    </div>
                    <div>
                      <span>Total</span>
                      <strong>{formatMoney(cartTotal)}</strong>
                    </div>
                  </div>

                  <button className="button button-primary" disabled={busy || !cart.items.length} type="submit">
                    Place order
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : null}

        {panel === 'orders' && session?.user ? (
          <section className="content-single">
            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Your orders</p>
                  <h3>{isAdmin ? 'All orders' : 'Order history'}</h3>
                </div>
                <span className="muted">{visibleOrders.length} records</span>
              </div>

              <div className="order-tabs">
                <button
                  className={orderView === 'all' ? 'active' : ''}
                  type="button"
                  onClick={() => setOrderView('all')}
                >
                  All orders
                </button>
                <button
                  className={orderView === 'today' ? 'active' : ''}
                  type="button"
                  onClick={() => setOrderView('today')}
                >
                  Today's orders
                </button>
              </div>

              <div className="orders-list">
                {visibleOrders.map((order) => (
                  <article className="order-card" key={order.id}>
                    <div className="order-card-top">
                      <div>
                        <strong>{order.id}</strong>
                        <p>{order.restaurantName}</p>
                      </div>
                      <span className={statusClass(order.status)}>{statusLabels[order.status]}</span>
                    </div>
                    <div className="order-meta">
                      <span>{order.customerName}</span>
                      <span>{order.phone}</span>
                      <span>{new Date(order.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="order-lines">
                      {normalizeOrders(order.lines).map((line, index) => (
                        <div key={`${order.id}-${index}`}>
                          {line.quantity}x {line.item?.name || 'Item'}
                        </div>
                      ))}
                    </div>
                    <div className="order-total">
                      <span>{formatMoney(order.total)}</span>
                      <span>{order.address}</span>
                    </div>
                    {isAdmin ? (
                      <div className="order-admin-controls">
                        <div className="two-col">
                          <label>
                            Status
                            <select
                              disabled={terminalStatuses.has(order.status)}
                              value={orderDrafts[order.id]?.status || order.status}
                              onChange={(event) =>
                                setOrderDrafts((current) => ({
                                  ...current,
                                  [order.id]: {
                                    ...(current[order.id] || {}),
                                    status: event.target.value,
                                  },
                                }))
                              }
                            >
                              {Object.keys(statusLabels).map((status) => (
                                <option key={status} value={status}>
                                  {statusLabels[status]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Rider name
                            <input
                              disabled={terminalStatuses.has(order.status)}
                              value={orderDrafts[order.id]?.riderName ?? order.riderName ?? ''}
                              onChange={(event) =>
                                setOrderDrafts((current) => ({
                                  ...current,
                                  [order.id]: {
                                    ...(current[order.id] || {}),
                                    riderName: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        </div>
                        <button
                          className="button button-primary"
                          disabled={busy || terminalStatuses.has(order.status)}
                          type="button"
                          onClick={() => handleStatusSave(order.id)}
                        >
                          Save status
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {visibleOrders.length === 0 ? <div className="empty-state">No orders found.</div> : null}
              </div>
            </div>
          </section>
        ) : null}

        {panel === 'admin' && isAdmin ? (
          <section className="content-grid admin-grid">
            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Restaurant editor</p>
                  <h3>{editingRestaurantId ? 'Edit restaurant' : 'Create restaurant'}</h3>
                </div>
                <button className="button button-ghost" type="button" onClick={resetRestaurantForm}>
                  New
                </button>
              </div>

              <form className="stack" onSubmit={handleRestaurantSubmit}>
                <div className="two-col">
                  <label>
                    Name
                    <input
                      aria-invalid={restaurantErrors.name ? 'true' : 'false'}
                      value={restaurantForm.name}
                      onChange={(event) => setRestaurantField('name', event.target.value)}
                    />
                    {restaurantErrors.name ? <span className="field-error">{restaurantErrors.name}</span> : null}
                  </label>
                  <label>
                    Cuisine
                    <input
                      aria-invalid={restaurantErrors.cuisine ? 'true' : 'false'}
                      value={restaurantForm.cuisine}
                      onChange={(event) => setRestaurantField('cuisine', event.target.value)}
                    />
                    {restaurantErrors.cuisine ? <span className="field-error">{restaurantErrors.cuisine}</span> : null}
                  </label>
                </div>
                <div className="three-col">
                  <label>
                    Rating
                    <input
                      aria-invalid={restaurantErrors.rating ? 'true' : 'false'}
                      type="number"
                      step="0.1"
                      value={restaurantForm.rating}
                      onChange={(event) => setRestaurantField('rating', event.target.value)}
                    />
                    {restaurantErrors.rating ? <span className="field-error">{restaurantErrors.rating}</span> : null}
                  </label>
                  <label>
                    Minutes
                    <input
                      aria-invalid={restaurantErrors.minutes ? 'true' : 'false'}
                      type="number"
                      value={restaurantForm.minutes}
                      onChange={(event) => setRestaurantField('minutes', event.target.value)}
                    />
                    {restaurantErrors.minutes ? <span className="field-error">{restaurantErrors.minutes}</span> : null}
                  </label>
                  <label>
                    Delivery fee
                    <input
                      aria-invalid={restaurantErrors.deliveryFee ? 'true' : 'false'}
                      type="number"
                      value={restaurantForm.deliveryFee}
                      onChange={(event) => setRestaurantField('deliveryFee', event.target.value)}
                    />
                    {restaurantErrors.deliveryFee ? (
                      <span className="field-error">{restaurantErrors.deliveryFee}</span>
                    ) : null}
                  </label>
                </div>
                <label>
                  Color
                  <input
                    aria-invalid={restaurantErrors.colorHex ? 'true' : 'false'}
                    value={restaurantForm.colorHex}
                    onChange={(event) => setRestaurantField('colorHex', event.target.value)}
                    placeholder="#FFE7A3"
                  />
                  {restaurantErrors.colorHex ? <span className="field-error">{restaurantErrors.colorHex}</span> : null}
                </label>

                <div className="menu-editor">
                  <div className="menu-editor-head">
                    <strong>Menu items</strong>
                  </div>

                  {restaurantForm.menu.map((item, index) => (
                    <div className="menu-row" key={index}>
                      <div className="two-col">
                        <label>
                          Item name
                          <input
                            aria-invalid={restaurantErrors.menu?.[index]?.name ? 'true' : 'false'}
                            value={item.name}
                            onChange={(event) => setMenuField(index, 'name', event.target.value)}
                          />
                          {restaurantErrors.menu?.[index]?.name ? (
                            <span className="field-error">{restaurantErrors.menu[index].name}</span>
                          ) : null}
                        </label>
                        <label>
                          Tag
                          <input
                            aria-invalid={restaurantErrors.menu?.[index]?.tag ? 'true' : 'false'}
                            value={item.tag}
                            onChange={(event) => setMenuField(index, 'tag', event.target.value)}
                          />
                          {restaurantErrors.menu?.[index]?.tag ? (
                            <span className="field-error">{restaurantErrors.menu[index].tag}</span>
                          ) : null}
                        </label>
                      </div>
                      <label>
                        Description
                        <input
                          aria-invalid={restaurantErrors.menu?.[index]?.description ? 'true' : 'false'}
                          value={item.description}
                          onChange={(event) => setMenuField(index, 'description', event.target.value)}
                        />
                        {restaurantErrors.menu?.[index]?.description ? (
                          <span className="field-error">{restaurantErrors.menu[index].description}</span>
                        ) : null}
                      </label>
                      <div className="menu-row-bottom">
                        <label>
                          Price
                          <input
                            aria-invalid={restaurantErrors.menu?.[index]?.price ? 'true' : 'false'}
                            type="number"
                            value={item.price}
                            onChange={(event) => setMenuField(index, 'price', event.target.value)}
                          />
                          {restaurantErrors.menu?.[index]?.price ? (
                            <span className="field-error">{restaurantErrors.menu[index].price}</span>
                          ) : null}
                        </label>
                        <label>
                          Category
                          <select
                            value={item.category}
                            onChange={(event) => setMenuField(index, 'category', event.target.value)}
                          >
                            {categories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="row-actions">
                          <button
                            className="button button-ghost"
                            type="button"
                            onClick={addMenuRow}
                          >
                            Add row
                          </button>
                          <button
                            className="button button-ghost"
                            type="button"
                            onClick={() => removeMenuRow(index)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="button button-primary" disabled={busy} type="submit">
                  {editingRestaurantId ? 'Update restaurant' : 'Create restaurant'}
                </button>
              </form>
            </div>

            <div className="panel">
              <div className="restaurant-list">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Existing restaurants</p>
                    <h3>Edit or delete restaurants</h3>
                  </div>
                  <span className="muted">{restaurants.length} records</span>
                </div>
                {pagedRestaurants.map((restaurant) => (
                  <article className="admin-restaurant-row" key={restaurant.id}>
                    <div>
                      <span>{restaurant.name}</span>
                      <small>{restaurant.cuisine}</small>
                    </div>
                    <div className="restaurant-row-actions">
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => openRestaurantEditor(restaurant)}
                      >
                        Edit
                      </button>
                      <button
                        className="button button-danger"
                        disabled={busy}
                        type="button"
                        onClick={() => handleDeleteRestaurant(restaurant)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {restaurants.length === 0 ? <div className="empty-state">No restaurants found.</div> : null}
                {restaurants.length > restaurantsPerPage ? (
                  <div className="pagination">
                    <button
                      className="button button-ghost"
                      disabled={restaurantPage === 1}
                      type="button"
                      onClick={() => setRestaurantPage((page) => Math.max(1, page - 1))}
                    >
                      Previous
                    </button>
                    <span className="muted">
                      Page {restaurantPage} of {restaurantPageCount}
                    </span>
                    <button
                      className="button button-ghost"
                      disabled={restaurantPage === restaurantPageCount}
                      type="button"
                      onClick={() => setRestaurantPage((page) => Math.min(restaurantPageCount, page + 1))}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {authOpen && !session?.user ? (
          <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Authentication dialog">
            <div className="auth-modal-backdrop" />
            <div className="auth-modal-card panel">
              <div className="auth-modal-head">
                <div>
                  <p className="eyebrow">Account access</p>
                  <h3>{authMode === 'signin' ? 'Sign in' : 'Create account'}</h3>
                </div>
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => {
                    setAuthOpen(false);
                    clearAuthErrors();
                  }}
                >
                  Close
                </button>
              </div>

              {authError ? (
                <div className="alert alert-error" role="alert">
                  {authError}
                </div>
              ) : null}

              <div className="segmented">
                <button
                  className={authMode === 'signin' ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    clearAuthErrors();
                  }}
                >
                  Sign in
                </button>
                <button
                  className={authMode === 'signup' ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    clearAuthErrors();
                  }}
                >
                  Sign up
                </button>
              </div>

              {authMode === 'signin' ? (
                <form className="stack" onSubmit={handleSignIn}>
                  <label>
                    Phone
                    <input
                      value={signInForm.phone}
                      aria-invalid={authFieldErrors.phone ? 'true' : 'false'}
                      onChange={(event) => {
                        setAuthError('');
                        setAuthFieldErrors((current) => ({ ...current, phone: '' }));
                        setSignInForm((current) => ({ ...current, phone: event.target.value }));
                      }}
                      placeholder="017....."
                    />
                    {authFieldErrors.phone ? <div className="field-error">{authFieldErrors.phone}</div> : null}
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={signInForm.password}
                      aria-invalid={authFieldErrors.password ? 'true' : 'false'}
                      onChange={(event) => {
                        setAuthError('');
                        setAuthFieldErrors((current) => ({ ...current, password: '' }));
                        setSignInForm((current) => ({ ...current, password: event.target.value }));
                      }}
                      placeholder="Password"
                    />
                    {authFieldErrors.password ? (
                      <div className="field-error">{authFieldErrors.password}</div>
                    ) : null}
                  </label>
                  <button className="button button-primary" disabled={busy} type="submit">
                    Sign in
                  </button>
                </form>
              ) : (
                <form className="stack" onSubmit={handleSignUp}>
                  <label>
                    Name
                    <input
                      value={signUpForm.name}
                      aria-invalid={authFieldErrors.name ? 'true' : 'false'}
                      onChange={(event) => {
                        setAuthError('');
                        setAuthFieldErrors((current) => ({ ...current, name: '' }));
                        setSignUpForm((current) => ({ ...current, name: event.target.value }));
                      }}
                      placeholder="Your name"
                    />
                    {authFieldErrors.name ? <div className="field-error">{authFieldErrors.name}</div> : null}
                  </label>
                  <label>
                    Phone
                    <input
                      value={signUpForm.phone}
                      aria-invalid={authFieldErrors.phone ? 'true' : 'false'}
                      onChange={(event) => {
                        setAuthError('');
                        setAuthFieldErrors((current) => ({ ...current, phone: '' }));
                        setSignUpForm((current) => ({ ...current, phone: event.target.value }));
                      }}
                      placeholder="01xxxxxxxxx"
                    />
                    {authFieldErrors.phone ? <div className="field-error">{authFieldErrors.phone}</div> : null}
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={signUpForm.password}
                      aria-invalid={authFieldErrors.password ? 'true' : 'false'}
                      onChange={(event) => {
                        setAuthError('');
                        setAuthFieldErrors((current) => ({ ...current, password: '' }));
                        setSignUpForm((current) => ({ ...current, password: event.target.value }));
                      }}
                      placeholder="6+ characters"
                    />
                    {authFieldErrors.password ? (
                      <div className="field-error">{authFieldErrors.password}</div>
                    ) : null}
                  </label>
                  <button className="button button-primary" disabled={busy} type="submit">
                    Create account
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : null}

        {logoutOpen && session?.user ? (
          <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Logout confirmation dialog">
            <div className="auth-modal-backdrop" onClick={cancelLogout} />
            <div className="auth-modal-card panel logout-modal-card">
              <div className="auth-modal-head">
                <div>
                  <p className="eyebrow">Confirm sign out</p>
                  <h3>{logoutBusy ? 'Signing out...' : 'Leave your account?'}</h3>
                </div>
                <button className="button button-ghost" type="button" onClick={cancelLogout} disabled={logoutBusy}>
                  Close
                </button>
              </div>
              <p className="logout-message">
                {logoutBusy
                  ? 'Please wait while we clear the session.'
                  : 'You will return to the login state after signing out.'}
              </p>
              <div className="logout-actions">
                <button className="button button-ghost" type="button" onClick={cancelLogout} disabled={logoutBusy}>
                  Cancel
                </button>
                <button className="button button-danger" type="button" onClick={handleLogout} disabled={logoutBusy}>
                  {logoutBusy ? 'Signing out...' : 'Sign out'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
