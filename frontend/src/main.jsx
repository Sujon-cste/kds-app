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

const categories = ['food', 'medicine', 'others'];

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
  const [signInForm, setSignInForm] = useState(blankSignIn);
  const [signUpForm, setSignUpForm] = useState(blankSignUp);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [restaurantForm, setRestaurantForm] = useState(blankRestaurant());
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);
  const [orderDrafts, setOrderDrafts] = useState({});
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
          setOrders(ordersPayload.orders || []);
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

  async function reloadData(token = session?.token) {
    clearNotifications();
    try {
      const restaurantsPayload = await api.getRestaurants();
      setRestaurants(restaurantsPayload.restaurants || []);
      if (token) {
        const ordersPayload = await api.getOrders(token);
        setOrders(ordersPayload.orders || []);
      }
    } catch (err) {
      notify('error', err.message);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    clearNotifications();
    setBusy(true);
    try {
      const payload = await api.signIn(signInForm.phone, signInForm.password);
      setSession(payload);
      setSignInForm(blankSignIn);
      setAuthMode('signin');
      setPanel(payload.user.role === 'admin' ? 'orders' : 'browse');
      await reloadData(payload.token);
      notify('success', 'Signed in successfully.');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    clearNotifications();
    setBusy(true);
    try {
      const payload = await api.signUp(signUpForm.name, signUpForm.phone, signUpForm.password);
      setSession(payload);
      setSignUpForm(blankSignUp);
      setAuthMode('signin');
      setPanel('browse');
      await reloadData(payload.token);
      notify('success', 'Account created.');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
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
    if (!checkoutAddress.trim()) {
      notify('error', 'Enter a delivery address.');
      return;
    }

    setBusy(true);
    try {
      const payload = await api.createOrder(session.token, {
        restaurantName: cart.restaurantName,
        customerName: checkoutName || session.user.name,
        phone: checkoutPhone || session.user.phone,
        address: checkoutAddress,
        subtotal: cartSubtotal,
        deliveryFee: cartDeliveryFee,
        lines: cart.items.map((entry) => ({
          quantity: entry.quantity,
          item: entry.item,
        })),
      });

      setOrders((current) => [payload.order[0], ...current]);
      setCart({
        restaurantId: null,
        restaurantName: '',
        deliveryFee: 0,
        items: [],
      });
      setCheckoutAddress('');
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
  }

  function setMenuField(index, field, value) {
    setRestaurantForm((current) => {
      const menu = current.menu.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      );
      return { ...current, menu };
    });
  }

  function addMenuRow() {
    setRestaurantForm((current) => ({ ...current, menu: [...current.menu, blankMenuItem()] }));
  }

  function removeMenuRow(index) {
    setRestaurantForm((current) => {
      const menu = current.menu.filter((_, itemIndex) => itemIndex !== index);
      return { ...current, menu: menu.length ? menu : [blankMenuItem()] };
    });
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
  }

  function resetRestaurantForm() {
    setEditingRestaurantId(null);
    setRestaurantForm(blankRestaurant());
  }

  async function handleRestaurantSubmit(event) {
    event.preventDefault();
    if (!session?.token) {
      notify('error', 'Sign in as admin first.');
      return;
    }
    clearNotifications();
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
    const order = orders.find((entry) => entry.id === orderCode);
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

  const selectedMenuItems = selectedRestaurant?.menu || [];
  const isAdmin = session?.user?.role === 'admin';

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">KDS React Web</div>
          <h1>Khilkhet Delivery Service</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="chip"
            onClick={() => setPanel(isAdmin ? 'orders' : 'browse')}
            type="button"
          >
            {isAdmin ? 'Admin view' : 'Browse'}
          </button>
          {session?.user ? (
            <>
              <div className="user-pill">
                <strong>{session.user.name}</strong>
                <span>{session.user.role}</span>
              </div>
              <button className="button button-ghost" onClick={handleLogout} type="button">
                Logout
              </button>
            </>
          ) : null}
        </div>
      </header>

      <main className="layout">
        <section className="hero panel">
          <div className="hero-copy">
            <p className="eyebrow">Browser frontend for the existing Node API</p>
            <h2>Fast ordering, admin tools, and a clean web checkout flow.</h2>
            <p>
              This React app talks to your current backend without changing the API contract.
              Run it locally for development or build it for cPanel deployment later.
            </p>
            <div className="hero-stats">
              <div>
                <strong>{restaurants.length}</strong>
                <span>restaurants</span>
              </div>
              <div>
                <strong>{orders.length}</strong>
                <span>orders</span>
              </div>
              <div>
                <strong>{cart.items.length}</strong>
                <span>cart items</span>
              </div>
            </div>
          </div>

          <div className="auth-card panel-inset">
            {!session?.user ? (
              <>
                <div className="segmented">
                  <button
                    className={authMode === 'signin' ? 'active' : ''}
                    type="button"
                    onClick={() => setAuthMode('signin')}
                  >
                    Sign in
                  </button>
                  <button
                    className={authMode === 'signup' ? 'active' : ''}
                    type="button"
                    onClick={() => setAuthMode('signup')}
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
                        onChange={(event) =>
                          setSignInForm((current) => ({ ...current, phone: event.target.value }))
                        }
                        placeholder="01700000000"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        value={signInForm.password}
                        onChange={(event) =>
                          setSignInForm((current) => ({ ...current, password: event.target.value }))
                        }
                        placeholder="Password"
                      />
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
                        onChange={(event) =>
                          setSignUpForm((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Your name"
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        value={signUpForm.phone}
                        onChange={(event) =>
                          setSignUpForm((current) => ({ ...current, phone: event.target.value }))
                        }
                        placeholder="01xxxxxxxxx"
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        value={signUpForm.password}
                        onChange={(event) =>
                          setSignUpForm((current) => ({ ...current, password: event.target.value }))
                        }
                        placeholder="6+ characters"
                      />
                    </label>
                    <button className="button button-primary" disabled={busy} type="submit">
                      Create account
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="signed-in-box">
                <span className="eyebrow">Signed in</span>
                <h3>{session.user.name}</h3>
                <p>{session.user.phone}</p>
                <p className="muted">Role: {session.user.role}</p>
              </div>
            )}
          </div>
        </section>

        <section className="toolbar panel">
          <div className="search-box">
            <label>
              Search restaurants or menu items
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Biryani, burger, soup..."
              />
            </label>
          </div>
          <div className="toolbar-actions">
            <button
              className={panel === 'browse' ? 'button button-primary' : 'button button-ghost'}
              type="button"
              onClick={() => setPanel('browse')}
            >
              Browse
            </button>
            <button
              className={panel === 'orders' ? 'button button-primary' : 'button button-ghost'}
              type="button"
              onClick={() => setPanel('orders')}
            >
              Orders
            </button>
            {isAdmin ? (
              <button
                className={panel === 'admin' ? 'button button-primary' : 'button button-ghost'}
                type="button"
                onClick={() => setPanel('admin')}
              >
                Admin
              </button>
            ) : null}
            <button className="button button-ghost" type="button" onClick={reloadData}>
              Refresh
            </button>
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

        {panel === 'orders' ? (
          <section className="content-grid">
            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Your orders</p>
                  <h3>{isAdmin ? 'All orders' : 'Order history'}</h3>
                </div>
                <span className="muted">{orders.length} records</span>
              </div>

              <div className="orders-list">
                {orders.map((order) => (
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
                      {order.lines.map((line, index) => (
                        <div key={`${order.id}-${index}`}>
                          {line.quantity}x {line.item.name}
                        </div>
                      ))}
                    </div>
                    <div className="order-total">
                      <span>{formatMoney(order.total)}</span>
                      <span>{order.address}</span>
                    </div>
                  </article>
                ))}
                {orders.length === 0 ? <div className="empty-state">No orders yet.</div> : null}
              </div>
            </div>

            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Checkout</p>
                  <h3>Place the current cart</h3>
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

                <form className="stack" onSubmit={handleCheckout}>
                  <label>
                    Customer name
                    <input value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} />
                  </label>
                  <label>
                    Phone
                    <input value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} />
                  </label>
                  <label>
                    Address
                    <textarea
                      rows="4"
                      value={checkoutAddress}
                      onChange={(e) => setCheckoutAddress(e.target.value)}
                      placeholder="House, road, area"
                    />
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

                  <button className="button button-primary" disabled={busy} type="submit">
                    Place order
                  </button>
                </form>
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
                      value={restaurantForm.name}
                      onChange={(event) => setRestaurantField('name', event.target.value)}
                    />
                  </label>
                  <label>
                    Cuisine
                    <input
                      value={restaurantForm.cuisine}
                      onChange={(event) => setRestaurantField('cuisine', event.target.value)}
                    />
                  </label>
                </div>
                <div className="three-col">
                  <label>
                    Rating
                    <input
                      type="number"
                      step="0.1"
                      value={restaurantForm.rating}
                      onChange={(event) => setRestaurantField('rating', event.target.value)}
                    />
                  </label>
                  <label>
                    Minutes
                    <input
                      type="number"
                      value={restaurantForm.minutes}
                      onChange={(event) => setRestaurantField('minutes', event.target.value)}
                    />
                  </label>
                  <label>
                    Delivery fee
                    <input
                      type="number"
                      value={restaurantForm.deliveryFee}
                      onChange={(event) => setRestaurantField('deliveryFee', event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Color
                  <input
                    value={restaurantForm.colorHex}
                    onChange={(event) => setRestaurantField('colorHex', event.target.value)}
                    placeholder="#FFE7A3"
                  />
                </label>

                <div className="menu-editor">
                  <div className="menu-editor-head">
                    <strong>Menu items</strong>
                    <button className="button button-ghost" type="button" onClick={addMenuRow}>
                      Add row
                    </button>
                  </div>

                  {restaurantForm.menu.map((item, index) => (
                    <div className="menu-row" key={`${index}-${item.name}`}>
                      <div className="two-col">
                        <label>
                          Item name
                          <input
                            value={item.name}
                            onChange={(event) => setMenuField(index, 'name', event.target.value)}
                          />
                        </label>
                        <label>
                          Tag
                          <input
                            value={item.tag}
                            onChange={(event) => setMenuField(index, 'tag', event.target.value)}
                          />
                        </label>
                      </div>
                      <label>
                        Description
                        <input
                          value={item.description}
                          onChange={(event) => setMenuField(index, 'description', event.target.value)}
                        />
                      </label>
                      <div className="three-col">
                        <label>
                          Price
                          <input
                            type="number"
                            value={item.price}
                            onChange={(event) => setMenuField(index, 'price', event.target.value)}
                          />
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
              <div className="section-head">
                <div>
                  <p className="eyebrow">Manage orders</p>
                  <h3>Update order status</h3>
                </div>
                <span className="muted">{orders.length} records</span>
              </div>

              <div className="orders-list">
                {orders.map((order) => (
                  <article className="order-card" key={order.id}>
                    <div className="order-card-top">
                      <div>
                        <strong>{order.id}</strong>
                        <p>{order.restaurantName}</p>
                      </div>
                      <span className={statusClass(order.status)}>{statusLabels[order.status]}</span>
                    </div>
                    <div className="two-col">
                      <label>
                        Status
                        <select
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
                      disabled={busy}
                      type="button"
                      onClick={() => handleStatusSave(order.id)}
                    >
                      Save status
                    </button>
                  </article>
                ))}
                {orders.length === 0 ? <div className="empty-state">No orders to manage.</div> : null}
              </div>

              <div className="restaurant-list">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Existing restaurants</p>
                    <h3>Edit quickly</h3>
                  </div>
                </div>
                {restaurants.map((restaurant) => (
                  <button
                    className="admin-restaurant-row"
                    key={restaurant.id}
                    type="button"
                    onClick={() => openRestaurantEditor(restaurant)}
                  >
                    <span>{restaurant.name}</span>
                    <small>{restaurant.cuisine}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
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
