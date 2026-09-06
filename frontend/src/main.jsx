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
const managementRoles = new Set(['admin', 'regionalAdmin']);
const userRoleLabels = {
  customer: 'Customer',
  admin: 'Admin',
  rider: 'Rider',
  regionalAdmin: 'Regional admin',
  other: 'Other',
};

function createBlankCart() {
  return {
    merchantId: null,
    merchantType: 'restaurant',
    merchantKey: '',
    merchantName: '',
    deliveryFee: 0,
    items: [],
  };
}

function getMerchantKey(merchant) {
  if (!merchant) {
    return '';
  }
  return `${merchant.type || 'restaurant'}:${merchant.id ?? ''}`;
}

function getMerchantKeyFromParts(type, id) {
  return `${type || 'restaurant'}:${id ?? ''}`;
}

function normalizeCartState(value) {
  if (!value || typeof value !== 'object') {
    return createBlankCart();
  }

  if ('merchantId' in value || 'merchantType' in value) {
    return {
      ...createBlankCart(),
      ...value,
      items: Array.isArray(value.items) ? value.items : [],
      merchantKey: value.merchantKey || getMerchantKeyFromParts(value.merchantType, value.merchantId),
    };
  }

  return {
    merchantId: value.restaurantId ?? null,
    merchantType: 'restaurant',
    merchantKey: getMerchantKeyFromParts('restaurant', value.restaurantId ?? null),
    merchantName: value.restaurantName || '',
    deliveryFee: Number(value.deliveryFee || 0),
    items: Array.isArray(value.items) ? value.items : [],
  };
}

function createInitialShops() {
  return [
    {
      id: 'shop-tech-hub',
      type: 'shop',
      name: 'Tech Hub',
      active: true,
      deliveryFee: 60,
      colorHex: '#DFF4FF',
      imageUrl: '',
      products: [
        {
          id: 'product-headphones',
          name: 'Wireless Headphones',
          description: 'Comfort fit, noise isolation, and long battery life.',
          price: 2490,
          stockQty: 18,
          trackStock: true,
          category: 'electronics',
          imageUrl: '',
        },
        {
          id: 'product-watch',
          name: 'Smart Watch',
          description: 'Track health, messages, and daily activity.',
          price: 3990,
          stockQty: 9,
          trackStock: true,
          category: 'electronics',
          imageUrl: '',
        },
      ],
    },
    {
      id: 'shop-home-bazaar',
      type: 'shop',
      name: 'Home Bazaar',
      active: true,
      deliveryFee: 45,
      colorHex: '#FFF1D6',
      imageUrl: '',
      products: [
        {
          id: 'product-detergent',
          name: 'Laundry Detergent',
          description: 'Family-size detergent for everyday use.',
          price: 320,
          stockQty: 25,
          trackStock: true,
          category: 'home',
          imageUrl: '',
        },
        {
          id: 'product-kettle',
          name: 'Electric Kettle',
          description: 'Compact kettle for quick tea and coffee.',
          price: 1590,
          stockQty: 6,
          trackStock: true,
          category: 'home',
          imageUrl: '',
        },
      ],
    },
  ];
}

const blankMenuItem = () => ({
  name: '',
  description: '',
  price: '',
  tag: 'Item',
  category: 'food',
  imageUrl: '',
});

const blankRestaurant = () => ({
  name: '',
  cuisine: '',
  rating: '4.5',
  minutes: '25',
  deliveryFee: '40',
  colorHex: '#FFE7A3',
  imageUrl: '',
  menu: [blankMenuItem()],
});

const blankShopProduct = () => ({
  name: '',
  description: '',
  price: '',
  stockQty: '1',
  trackStock: true,
  category: 'general',
  imageUrl: '',
});

const blankShop = () => ({
  name: '',
  deliveryFee: '50',
  colorHex: '#DFF4FF',
  imageUrl: '',
  active: true,
  description: '',
  products: [blankShopProduct()],
});

const blankSignIn = { phone: '', password: '' };
const blankSignUp = { name: '', phone: '', password: '' };
const blankUserForm = {
  name: '',
  phone: '',
  nid: '',
  email: '',
  address: '',
  role: 'rider',
};

const heroSlides = [
  {
    src: '/hero-biryani.png',
    alt: 'A warm bowl of biryani with garnish',
    kicker: 'Biryani',
    title: 'Hot biryani, ready to deliver',
    text: 'Rich, aromatic, and built for the first hero slide.',
  },
  {
    src: '/hero-burger.png',
    alt: 'A stacked burger with fries',
    kicker: 'Burger',
    title: 'Burger combos with a fast finish',
    text: 'Juicy, crisp, and ideal for a bold second slide.',
  },
  {
    src: '/hero-pasta.png',
    alt: 'Creamy pasta served in a bowl',
    kicker: 'Pasta',
    title: 'Creamy pasta for quick comfort',
    text: 'Smooth, warm, and easy to order in just a few taps.',
  },
  {
    src: '/hero-dessert.png',
    alt: 'A dessert plate with rich toppings',
    kicker: 'Dessert',
    title: 'Dessert that finishes the meal well',
    text: 'Sweet, polished, and made to keep the hero lively.',
  },
  {
    src: '/hero-thali.png',
    alt: 'A colorful thali with multiple dishes',
    kicker: 'Thali',
    title: 'A full thali for everyday delivery',
    text: 'Balanced, colorful, and perfect for the final slide.',
  },
];

function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return initialValue;
      }
      const parsed = JSON.parse(raw);
      if (key === 'kds-react-cart') {
        return normalizeCartState(parsed);
      }
      return parsed;
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
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

function normalizeInventoryRows(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function isManagementRole(role) {
  return managementRoles.has(role);
}

function formatUserRole(role) {
  return userRoleLabels[role] || role || 'Unknown';
}

function normalizeUser(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    id: value.id,
    name: value.name || '',
    phone: value.phone || '',
    nid: value.nid || '',
    email: value.email || '',
    address: value.address || '',
    role: value.role || 'other',
    isActive: value.isActive !== false,
    createdAt: value.createdAt || null,
  };
}

function buildInventoryLookup(inventoryRows) {
  const lookup = new Map();
  normalizeInventoryRows(inventoryRows).forEach((row) => {
    lookup.set(
      `${row.merchant_type}::${row.merchant_name}::${row.item_name}`,
      {
        id: row.id,
        stockQty: Number(row.stock_qty || 0),
        trackStock: row.track_stock !== 0,
      },
    );
  });
  return lookup;
}

function mergeRestaurantsWithInventory(restaurants, inventoryRows) {
  return (restaurants || []).map((restaurant) => ({
    ...restaurant,
    menu: (restaurant.menu || []).map((item) => {
      return {
        ...item,
        stockQty: null,
        trackStock: false,
      };
    }),
  }));
}

function mergeShopsWithInventory(shops, inventoryRows) {
  const lookup = buildInventoryLookup(inventoryRows);
  return (shops || []).map((shop) => ({
    ...shop,
    products: (shop.products || []).map((product) => {
      const match = lookup.get(`shop::${shop.name}::${product.name}`) || null;
      if (!match) {
        return product;
      }

      return {
        ...product,
        stockQty: match.stockQty,
        trackStock: match.trackStock,
      };
    }),
  }));
}

function normalizeInventoryRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    id: row.id,
    merchant_type: row.merchant_type,
    merchant_name: row.merchant_name,
    item_name: row.item_name,
    stock_qty: Number(row.stock_qty || 0),
    track_stock: row.track_stock !== 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function stripUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((entry) => entry !== undefined);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, stripUndefined(entry)]),
  );
}

function serializeOrderItem(item) {
  return stripUndefined({
    id: item?.id ?? null,
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: Number(item?.price || 0),
    type: item?.type ?? '',
    tag: item?.tag ?? '',
    category: item?.category ?? '',
    imageUrl: item?.imageUrl ?? '',
    trackStock: item?.trackStock ?? false,
    stockQty: item?.stockQty ?? null,
  });
}

function getReadableErrorMessage(message) {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('bind parameters must not contain undefined')) {
    return 'We could not place this order because some order data is missing. Please refresh the page, re-add the items, and try again.';
  }

  if (normalized.includes('sql') || normalized.includes('database') || normalized.includes('query')) {
    return 'We could not place your order right now. Please try again in a moment.';
  }

  return message || 'Something went wrong. Please try again.';
}

function App() {
  const [session, setSession] = useLocalStorageState('kds-react-session', null);
  const [cart, setCart] = useLocalStorageState('kds-react-cart', createBlankCart());
  const [shops, setShops] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authOpen, setAuthOpen] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authFieldErrors, setAuthFieldErrors] = useState({});
  const [showSignInPassword, setShowSignInPassword] = useState(false);
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
  const [browseView, setBrowseView] = useState('all');
  const [selectedMerchantKey, setSelectedMerchantKey] = useState(null);
  const [adminSection, setAdminSection] = useState('restaurants');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryDrafts, setInventoryDrafts] = useState({});
  const [shopForm, setShopForm] = useState(blankShop);
  const [shopErrors, setShopErrors] = useState({ products: [] });
  const [editingShopId, setEditingShopId] = useState(null);
  const [userForm, setUserForm] = useState(blankUserForm);
  const [userErrors, setUserErrors] = useState({});
  const [userCreatedCredentials, setUserCreatedCredentials] = useState(null);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  const restaurantMerchants = useMemo(
    () =>
      restaurants.map((restaurant) => ({
        id: restaurant.id,
        type: 'restaurant',
        key: getMerchantKeyFromParts('restaurant', restaurant.id),
        name: restaurant.name,
        cuisine: restaurant.cuisine,
        active: restaurant.active !== false,
        rating: restaurant.rating,
        minutes: restaurant.minutes,
        deliveryFee: restaurant.deliveryFee,
        colorHex: restaurant.colorHex,
        imageUrl: restaurant.imageUrl,
        description: `${restaurant.cuisine} restaurant`,
      items: (restaurant.menu || []).map((item) => ({
        ...item,
          id: item.id || `${restaurant.id}-${item.name}`,
          type: 'food',
          trackStock: false,
          stockQty: null,
        })),
      })),
    [restaurants],
  );

  const shopMerchants = useMemo(
    () =>
      shops.map((shop) => ({
        id: shop.id,
        type: 'shop',
        key: getMerchantKeyFromParts('shop', shop.id),
        name: shop.name,
        active: shop.active !== false,
        deliveryFee: shop.deliveryFee,
        colorHex: shop.colorHex,
        imageUrl: shop.imageUrl,
        description: shop.description || 'Shop',
        items: (shop.products || []).map((product) => ({
          ...product,
          id: product.id || `${shop.id}-${product.name}`,
          type: 'product',
          trackStock: product.trackStock !== false,
          stockQty: Number(product.stockQty || 0),
        })),
      })),
    [shops],
  );

  const merchants = useMemo(
    () => [...restaurantMerchants, ...shopMerchants],
    [restaurantMerchants, shopMerchants],
  );

  const filteredMerchants = useMemo(() => {
    const query = search.trim().toLowerCase();
    return merchants.filter((merchant) => {
      if (browseView === 'food' && merchant.type !== 'restaurant') {
        return false;
      }
      if (browseView === 'shops' && merchant.type !== 'shop') {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        merchant.name,
        merchant.cuisine,
        merchant.description,
        ...(merchant.items || []).map((item) => `${item.name} ${item.description || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [browseView, merchants, search]);

  const selectedMerchant = useMemo(
    () => merchants.find((merchant) => merchant.key === selectedMerchantKey) || null,
    [merchants, selectedMerchantKey],
  );

  useEffect(() => {
    if (!selectedMerchantKey) {
      return;
    }
    const stillVisible = filteredMerchants.some((merchant) => merchant.key === selectedMerchantKey);
    if (!stillVisible) {
      setSelectedMerchantKey(null);
    }
  }, [filteredMerchants, selectedMerchantKey]);

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
  const filteredInventoryItems = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase();
    return normalizeInventoryRows(inventoryItems).filter((item) => {
      if (!query) {
        return true;
      }
      const haystack = [item.merchant_name, item.item_name, item.merchant_type].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [inventoryItems, inventorySearch]);

  const normalizedCart = normalizeCartState(cart);
  const cartSubtotal = normalizedCart.items.reduce((sum, entry) => sum + Number(entry.item.price) * entry.quantity, 0);
  const cartDeliveryFee = Number(normalizedCart.deliveryFee || 0);
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
    if (isManagementRole(session?.user?.role) && panel === 'browse') {
      setPanel('admin');
      setAdminSection('dashboard');
    }
    if (session?.user?.role === 'rider' && panel === 'browse') {
      setPanel('rider');
    }
    if (session?.user?.role === 'customer' && panel === 'admin') {
      setPanel('browse');
    }
  }, [panel, session?.user?.role]);

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
      const loadUsers = token && isManagementRole(session?.user?.role);
      const [restaurantsPayload, shopsPayload, inventoryPayload, usersPayload, ordersPayload] =
        await Promise.all([
          api.getRestaurants(),
          api.getShops(),
          api.getInventory(),
          loadUsers ? api.getUsers(token) : Promise.resolve(null),
          token ? api.getOrders(token) : Promise.resolve(null),
        ]);
      const inventoryRows = normalizeInventoryRows(inventoryPayload.inventory);
      setInventoryItems(inventoryRows);
      setRestaurants(mergeRestaurantsWithInventory(restaurantsPayload.restaurants || [], inventoryRows));
      setShops(mergeShopsWithInventory(shopsPayload.shops || [], inventoryRows));
      if (usersPayload) {
        setUsers((usersPayload.users || []).map(normalizeUser).filter(Boolean));
      }
      if (ordersPayload) {
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
      if (isManagementRole(payload.user.role)) {
        setPanel('admin');
        setAdminSection('dashboard');
      } else if (payload.user.role === 'rider') {
        setPanel('rider');
      } else {
        setPanel('browse');
      }
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
    setUsers([]);
    setCart(createBlankCart());
    setPanel('browse');
    setSuccess('');
    setError('');
    setAuthOpen(false);
    setAuthMode('signin');
    setBusy(false);
    setUserCreatedCredentials(null);
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

  function handleAddToCart(merchant, item) {
    clearNotifications();
    const currentCart = normalizeCartState(cart);
    const nextMerchantKey = merchant.key || getMerchantKey(merchant);
    const isDifferentMerchant = currentCart.merchantKey && currentCart.merchantKey !== nextMerchantKey;
    if (isDifferentMerchant) {
      const confirmed = window.confirm(`Replace the current cart with ${merchant.name}?`);
      if (!confirmed) {
        return;
      }
    }

    setCart((current) => {
      const normalizedCurrent = normalizeCartState(current);
      const existingItems = isDifferentMerchant ? [] : normalizedCurrent.items;
      const currentQuantity = existingItems.find((entry) => entry.item.id === item.id)?.quantity || 0;
      if (merchant.type === 'shop' && item.trackStock !== false && Number(item.stockQty || 0) <= currentQuantity) {
        window.alert('This item is out of stock.');
        return normalizedCurrent;
      }
      const existingIndex = existingItems.findIndex((entry) => entry.item.id === item.id);
      const nextItems = existingIndex >= 0
        ? existingItems.map((entry, index) =>
            index === existingIndex ? { ...entry, quantity: entry.quantity + 1 } : entry,
          )
        : [...existingItems, { item, quantity: 1 }];

      return {
        merchantId: merchant.id,
        merchantType: merchant.type,
        merchantKey: nextMerchantKey,
        merchantName: merchant.name,
        deliveryFee: merchant.deliveryFee,
        items: nextItems,
      };
    });
    setSelectedMerchantKey(nextMerchantKey);
  }

  function updateCartQuantity(itemId, delta) {
    setCart((current) => {
      const normalizedCurrent = normalizeCartState(current);
      const lineItem = normalizedCurrent.items.find((entry) => entry.item.id === itemId) || null;
      if (
        delta > 0 &&
        normalizedCurrent.merchantType === 'shop' &&
        lineItem &&
        lineItem.item.trackStock !== false &&
        Number(lineItem.item.stockQty || 0) <= lineItem.quantity
      ) {
        return normalizedCurrent;
      }
      const items = normalizedCurrent.items
        .map((entry) =>
          entry.item.id === itemId ? { ...entry, quantity: entry.quantity + delta } : entry,
        )
        .filter((entry) => entry.quantity > 0);
      if (items.length === 0) {
        return createBlankCart();
      }
      return { ...normalizedCurrent, items };
    });
  }

  async function handleCheckout(event) {
    event.preventDefault();
    clearNotifications();
    if (!session?.token) {
      notify('error', 'Sign in before placing an order.');
      return;
    }
    const currentCart = normalizeCartState(cart);
    if (!currentCart.items.length) {
      notify('error', 'Your cart is empty.');
      return;
    }
    if (!validateCheckout()) {
      return;
    }

    setBusy(true);
    try {
      const lines = currentCart.items.map((entry) => ({
        quantity: Number(entry.quantity || 0),
        item: serializeOrderItem(entry.item),
      }));

      const payload = await api.createOrder(session.token, {
        merchantId: currentCart.merchantId ?? null,
        merchantType: currentCart.merchantType ?? 'restaurant',
        restaurantName: currentCart.merchantName || '',
        customerName: checkoutName.trim(),
        phone: checkoutPhone.trim(),
        address: checkoutAddress.trim(),
        subtotal: cartSubtotal,
        deliveryFee: cartDeliveryFee,
        lines,
      });

      const createdOrder = normalizeOrderPayload(payload);
      if (!createdOrder) {
        throw new Error('Order was created, but the server returned an invalid order response.');
      }

      setOrders((current) => [createdOrder, ...normalizeOrders(current)]);
      setCart(createBlankCart());
      setCheckoutAddress('');
      setCheckoutErrors({});
      setPanel('orders');
      notify('success', 'Order placed successfully.');
      await reloadData();
    } catch (err) {
      notify('error', getReadableErrorMessage(err.message));
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

  async function setRestaurantImage(file) {
    if (!file) {
      return;
    }
    const imageUrl = await readFileAsDataUrl(file);
    setRestaurantForm((current) => ({ ...current, imageUrl }));
    setRestaurantErrors((current) => ({ ...current, imageUrl: '' }));
  }

  async function setMenuImage(index, file) {
    if (!file) {
      return;
    }
    const imageUrl = await readFileAsDataUrl(file);
    setRestaurantForm((current) => {
      const menu = current.menu.map((item, itemIndex) =>
        itemIndex === index ? { ...item, imageUrl } : item,
      );
      return { ...current, menu };
    });
    setRestaurantErrors((current) => {
      const menu = [...(current.menu || [])];
      menu[index] = { ...(menu[index] || {}), imageUrl: '' };
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
      imageUrl: restaurant.imageUrl || '',
      menu: (restaurant.menu || []).length
        ? restaurant.menu.map((item) => ({
            name: item.name || '',
            description: item.description || '',
            price: String(item.price ?? ''),
            tag: item.tag || 'Item',
            category: item.category || 'food',
            imageUrl: item.imageUrl || '',
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
        imageUrl: restaurantForm.imageUrl.trim() || '',
        menu: restaurantForm.menu
          .filter((item) => item.name.trim())
          .map((item) => ({
            name: item.name.trim(),
            description: item.description.trim(),
            price: Number(item.price || 0),
            tag: item.tag.trim() || 'Item',
            category: item.category,
            imageUrl: item.imageUrl.trim() || '',
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
    const riderId = draft.riderId ? Number(draft.riderId) : order?.riderId || null;
    if (!status) {
      return;
    }
    if (status === 'riderAssigned' && !riderId) {
      notify('error', 'Select a rider before assigning the order.');
      return;
    }
    clearNotifications();
    setBusy(true);
    try {
      await api.updateOrderStatus(session.token, orderCode, {
        status,
        riderId: riderId || null,
        riderName: riderUsers.find((rider) => rider.id === riderId)?.name || order?.riderName || null,
        riderPhone: riderUsers.find((rider) => rider.id === riderId)?.phone || order?.riderPhone || null,
      });
      await reloadData();
      notify('success', `Updated ${orderCode}.`);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRiderStatusUpdate(orderCode, status) {
    if (!session?.token) {
      notify('error', 'Sign in first.');
      return;
    }
    clearNotifications();
    setBusy(true);
    try {
      await api.updateOrderStatus(session.token, orderCode, { status });
      await reloadData();
      notify('success', `Updated ${orderCode}.`);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRiderIssue(orderCode) {
    if (!session?.token) {
      notify('error', 'Sign in first.');
      return;
    }
    const issue = window.prompt('Describe the issue for this order');
    if (!issue || !issue.trim()) {
      return;
    }
    clearNotifications();
    setBusy(true);
    try {
      await api.updateOrderStatus(session.token, orderCode, { issue: issue.trim() });
      await reloadData();
      notify('success', `Issue noted for ${orderCode}.`);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleInventorySave(itemId) {
    if (!session?.token) {
      notify('error', 'Sign in as admin first.');
      return;
    }
    const draft = inventoryDrafts[itemId];
    const nextStockQty = Number(draft);
    if (!Number.isInteger(nextStockQty) || nextStockQty < 0) {
      notify('error', 'Enter a valid stock quantity.');
      return;
    }

    clearNotifications();
    setBusy(true);
    try {
      const payload = await api.updateInventory(session.token, itemId, { stockQty: nextStockQty });
      const updated = normalizeInventoryRow(payload.inventory);
      if (updated) {
        setInventoryItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      }
      setInventoryDrafts((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      await reloadData();
      notify('success', 'Stock updated.');
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

  function setShopField(field, value) {
    setShopForm((current) => ({ ...current, [field]: value }));
    setShopErrors((current) => ({ ...current, [field]: '' }));
  }

  function setShopProductField(index, field, value) {
    setShopForm((current) => {
      const products = current.products.map((product, productIndex) =>
        productIndex === index ? { ...product, [field]: value } : product,
      );
      return { ...current, products };
    });
    setShopErrors((current) => {
      const products = [...(current.products || [])];
      products[index] = { ...(products[index] || {}), [field]: '' };
      return { ...current, products };
    });
  }

  function addShopProductRow() {
    setShopForm((current) => ({ ...current, products: [...current.products, blankShopProduct()] }));
    setShopErrors((current) => ({ ...current, products: [...(current.products || []), {}] }));
  }

  function removeShopProductRow(index) {
    setShopForm((current) => {
      const products = current.products.filter((_, productIndex) => productIndex !== index);
      return { ...current, products: products.length ? products : [blankShopProduct()] };
    });
    setShopErrors((current) => {
      const products = (current.products || []).filter((_, productIndex) => productIndex !== index);
      return { ...current, products: products.length ? products : [{}] };
    });
  }

  function validateShopForm() {
    const nextErrors = { products: shopForm.products.map(() => ({})) };

    if (!shopForm.name.trim()) {
      nextErrors.name = 'Enter shop name.';
    }
    if (!shopForm.deliveryFee || Number(shopForm.deliveryFee) < 0) {
      nextErrors.deliveryFee = 'Enter a valid fee.';
    }
    if (shopForm.colorHex.trim() && !/^(#|0x)[0-9a-fA-F]{6,8}$/.test(shopForm.colorHex.trim())) {
      nextErrors.colorHex = 'Use a valid color like #DFF4FF.';
    }

    shopForm.products.forEach((product, index) => {
      if (!product.name.trim()) {
        nextErrors.products[index].name = 'Enter product name.';
      }
      if (!product.description.trim()) {
        nextErrors.products[index].description = 'Enter product description.';
      }
      if (!product.price || Number(product.price) <= 0) {
        nextErrors.products[index].price = 'Enter product price.';
      }
      if (product.trackStock !== false && (product.stockQty === '' || Number(product.stockQty) < 0)) {
        nextErrors.products[index].stockQty = 'Enter stock quantity.';
      }
    });

    const hasProductErrors = nextErrors.products.some((product) => Object.values(product).some(Boolean));
    const hasFormErrors = Object.entries(nextErrors).some(
      ([field, value]) => field !== 'products' && Boolean(value),
    );

    setShopErrors(nextErrors);
    return !hasProductErrors && !hasFormErrors;
  }

  function openShopEditor(shop) {
    setEditingShopId(shop.id);
    setShopForm({
      name: shop.name || '',
      deliveryFee: String(shop.deliveryFee ?? 50),
      colorHex: colorToCss(shop.colorHex || '#DFF4FF'),
      imageUrl: shop.imageUrl || '',
      active: shop.active !== false,
      description: shop.description || '',
      products: (shop.products || []).length
        ? shop.products.map((product) => ({
            name: product.name || '',
            description: product.description || '',
            price: String(product.price ?? ''),
            stockQty: String(product.stockQty ?? 1),
            trackStock: product.trackStock !== false,
            category: product.category || 'general',
            imageUrl: product.imageUrl || '',
          }))
        : [blankShopProduct()],
    });
    setAdminSection('shops');
    setShopErrors({
      products: (shop.products || []).length ? shop.products.map(() => ({})) : [{}],
    });
  }

  function resetShopForm() {
    setEditingShopId(null);
    setShopForm(blankShop());
    setShopErrors({ products: [{}] });
  }

  async function setShopImage(file) {
    if (!file) {
      return;
    }
    const imageUrl = await readFileAsDataUrl(file);
    setShopForm((current) => ({ ...current, imageUrl }));
    setShopErrors((current) => ({ ...current, imageUrl: '' }));
  }

  async function setShopProductImage(index, file) {
    if (!file) {
      return;
    }
    const imageUrl = await readFileAsDataUrl(file);
    setShopForm((current) => {
      const products = current.products.map((product, productIndex) =>
        productIndex === index ? { ...product, imageUrl } : product,
      );
      return { ...current, products };
    });
    setShopErrors((current) => {
      const products = [...(current.products || [])];
      products[index] = { ...(products[index] || {}), imageUrl: '' };
      return { ...current, products };
    });
  }

  async function handleShopSubmit(event) {
    event.preventDefault();
    if (!session?.token) {
      notify('error', 'Sign in as admin first.');
      return;
    }
    clearNotifications();
    if (!validateShopForm()) {
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: shopForm.name.trim(),
        deliveryFee: Number(shopForm.deliveryFee || 0),
        colorHex: shopForm.colorHex.trim() || '#DFF4FF',
        imageUrl: shopForm.imageUrl.trim() || '',
        active: shopForm.active !== false,
        description: shopForm.description.trim() || '',
        products: shopForm.products
          .filter((product) => product.name.trim())
          .map((product) => ({
            name: product.name.trim(),
            description: product.description.trim(),
            price: Number(product.price || 0),
            stockQty: Number(product.stockQty || 0),
            trackStock: product.trackStock !== false,
            category: product.category || 'general',
            imageUrl: product.imageUrl.trim() || '',
          })),
      };

      if (payload.products.length === 0) {
        throw new Error('Add at least one product.');
      }

      if (editingShopId) {
        await api.updateShop(session.token, editingShopId, payload);
      } else {
        await api.createShop(session.token, payload);
      }

      await reloadData();
      resetShopForm();
      notify('success', editingShopId ? 'Shop updated.' : 'Shop created.');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteShop(shop) {
    if (!session?.token) {
      notify('error', 'Sign in as admin first.');
      return;
    }
    const confirmed = window.confirm(`Delete ${shop.name}?`);
    if (!confirmed) {
      return;
    }
    clearNotifications();
    setBusy(true);
    try {
      await api.deleteShop(session.token, shop.id);
      if (editingShopId === shop.id) {
        resetShopForm();
      }
      await reloadData();
      notify('success', 'Shop deleted.');
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  function setUserField(field, value) {
    setUserForm((current) => ({ ...current, [field]: value }));
    setUserErrors((current) => ({ ...current, [field]: '' }));
  }

  function resetUserForm() {
    setUserForm(blankUserForm);
    setUserErrors({});
  }

  function validateUserForm() {
    const nextErrors = {};
    const phone = userForm.phone.trim();
    const nid = userForm.nid.trim();

    if (!userForm.name.trim()) {
      nextErrors.name = 'Enter user name.';
    }
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      nextErrors.phone = 'Enter a valid 11-digit mobile number.';
    }
    if (!/^(?:\d{10}|\d{13}|\d{17})$/.test(nid)) {
      nextErrors.nid = 'Enter a valid NID with 10, 13, or 17 digits.';
    }
    if (userForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    setUserErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleUserSubmit(event) {
    event.preventDefault();
    if (!session?.token) {
      notify('error', 'Sign in as admin first.');
      return;
    }
    clearNotifications();
    if (!validateUserForm()) {
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: userForm.name.trim(),
        phone: userForm.phone.trim(),
        nid: userForm.nid.trim(),
        email: userForm.email.trim(),
        address: userForm.address.trim(),
        role: userForm.role,
      };
      const created = await api.createUser(session.token, payload);
      const normalizedUser = normalizeUser(created.user);
      if (normalizedUser) {
        setUsers((current) => [normalizedUser, ...current.filter((user) => user.id !== normalizedUser.id)]);
      }
      setUserCreatedCredentials({
        name: payload.name,
        phone: payload.phone,
        temporaryPassword: created.temporaryPassword || '',
      });
      resetUserForm();
      await reloadData();
      notify('success', `${payload.name} added as ${formatUserRole(payload.role)}.`);
    } catch (err) {
      notify('error', err.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedMenuItems = selectedMerchant?.items || [];
  const isAdmin = isManagementRole(session?.user?.role);
  const isRider = session?.user?.role === 'rider';
  const riderUsers = useMemo(
    () => users.filter((user) => user.role === 'rider' && user.isActive),
    [users],
  );
  const totalCatalogItems = merchants.reduce((total, merchant) => total + (merchant.items || []).length, 0);
  const activeOrdersCount = normalizedOrders.filter((order) => !terminalStatuses.has(order.status)).length;
  const shopCount = shopMerchants.length;
  const restaurantCount = restaurantMerchants.length;
  const pendingOrdersCount = normalizedOrders.filter((order) => order.status === 'pending').length;
  const cartCount = normalizedCart.items.reduce((total, entry) => total + entry.quantity, 0);

  function openAuth(mode = 'signin') {
    clearAuthErrors();
    setShowSignInPassword(false);
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function openSection(section) {
    if (section === 'home') {
      if (isAdmin) {
        setPanel('admin');
        setAdminSection('dashboard');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (isRider) {
        setPanel('rider');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setBrowseView('all');
      setPanel('browse');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'restaurants') {
      if (isAdmin) {
        setPanel('admin');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (isRider) {
        setPanel('rider');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setBrowseView('food');
      setPanel('browse');
      window.scrollTo({ top: 680, behavior: 'smooth' });
      return;
    }
    if (section === 'orders') {
      if (isAdmin) {
        setPanel('admin');
        setAdminSection('orders');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (isRider) {
        setPanel('rider');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setPanel('orders');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'cart') {
      if (isRider) {
        return;
      }
      setPanel('cart');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (section === 'admin') {
      setPanel('admin');
      if (!adminSection || adminSection === 'dashboard') {
        setAdminSection('dashboard');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <div className={`shell ${isAdmin ? 'shell-admin' : ''}`}>
      <header className="site-header">
        <div className="site-header-strip">
          <span className="header-strip-badge">Fast delivery</span>
          <p>Order food, save favorites, and checkout from one clean storefront.</p>
          <span className="header-strip-contact">Support: +8801762-849868</span>
        </div>
        <div className="site-header-main">
          <button className="brand-lockup brand-button" type="button" onClick={() => openSection('home')}>
            <img
              alt="KD Easy Life logo"
              className="brand-logo"
              src="/kd-easy-life-logo.jpeg"
            />
            <div>
              <div className="eyebrow">KD Easy Life</div>
              <h1>Food Delivery</h1>
            </div>
          </button>

          <nav className="header-nav" aria-label="Primary">
            {isAdmin ? (
              <>
                <button className={panel === 'admin' ? 'active' : ''} type="button" onClick={() => openSection('home')}>
                  Dashboard
                </button>
                <button className={panel === 'orders' ? 'active' : ''} type="button" onClick={() => openSection('orders')}>
                  Orders
                </button>
                <button
                  className={panel === 'admin' ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    setPanel('admin');
                    setAdminSection('restaurants');
                  }}
                >
                  Catalog
                </button>
              </>
            ) : isRider ? (
              <button className={panel === 'rider' ? 'active' : ''} type="button" onClick={() => openSection('home')}>
                Rider dashboard
              </button>
            ) : (
              <>
                <button className={panel === 'browse' ? 'active' : ''} type="button" onClick={() => openSection('home')}>
                  Home
                </button>
                <button className={panel === 'browse' ? 'active' : ''} type="button" onClick={() => openSection('restaurants')}>
                  Marketplace
                </button>
                <button className={panel === 'orders' ? 'active' : ''} type="button" onClick={() => openSection('orders')}>
                  Orders
                </button>
                <button className="header-nav-link" type="button" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
                  Contact
                </button>
              </>
            )}
          </nav>

          <div className="topbar-actions header-actions">
            {!isAdmin && !isRider ? (
              <button className="header-cart" type="button" onClick={() => openSection('cart')}>
                <span className="header-cart-icon" aria-hidden="true">🛒</span>
                <span className="header-cart-text">
                  <strong>Cart</strong>
                  <small>{cartCount} item{cartCount === 1 ? '' : 's'}</small>
                </span>
              </button>
            ) : null}
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
            ) : (
              <button className="button button-primary" type="button" onClick={() => openAuth('signin')}>
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="layout">
        {isAdmin ? (
          <section className="hero panel admin-hero">
            <div className="admin-hero-copy">
              <p className="eyebrow">Admin dashboard</p>
              <h2>Control orders, catalog data, and merchant setup from one place.</h2>
              <p>
                This view is for operations only. Manage restaurants, shops, stock-tracked products, and active
                orders without storefront imagery.
              </p>
              <div className="admin-hero-actions">
                <button className="button button-primary" type="button" onClick={() => setPanel('orders')}>
                  View orders
                </button>
                <button className="button button-ghost" type="button" onClick={() => setPanel('admin')}>
                  Manage products
                </button>
              </div>
            </div>
            <div className="admin-hero-grid">
              <div className="admin-stat-card">
                <span>Active orders</span>
                <strong>{activeOrdersCount}</strong>
                <small>Orders currently in motion</small>
              </div>
              <div className="admin-stat-card">
                <span>Catalog items</span>
                <strong>{totalCatalogItems}</strong>
                <small>Restaurants and shop products</small>
              </div>
              <div className="admin-stat-card">
                <span>Restaurants</span>
                <strong>{restaurantCount}</strong>
                <small>Menu-based merchants</small>
              </div>
              <div className="admin-stat-card">
                <span>Shops</span>
                <strong>{shopCount}</strong>
                <small>Stock-managed merchants</small>
              </div>
            </div>
          </section>
        ) : isRider ? (
          <section className="hero panel rider-hero">
            <div className="hero-copy rider-hero-copy">
              <p className="eyebrow">Rider dashboard</p>
              <h2>Assigned orders only, nothing else.</h2>
              <p>
                Use this space to track the deliveries assigned to your account. All other storefront controls
                stay hidden.
              </p>
              <div className="hero-stats">
                <div>
                  <strong>{normalizedOrders.length}</strong>
                  <span>assigned orders</span>
                </div>
                <div>
                  <strong>{normalizedOrders.filter((order) => order.status === 'onTheWay').length}</strong>
                  <span>on the way</span>
                </div>
                <div>
                  <strong>{normalizedOrders.filter((order) => order.status === 'delivered').length}</strong>
                  <span>delivered</span>
                </div>
              </div>
            </div>
            <div className="panel rider-hero-card">
              <p className="eyebrow">Logged in as</p>
              <h3>{session?.user?.name}</h3>
              <p className="muted">{session?.user?.phone}</p>
              <p className="muted">Role: rider</p>
            </div>
          </section>
        ) : (
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
                  <strong>{normalizedCart.items.length}</strong>
                  <span>cart items</span>
                </div>
              </div>
            </div>
            <div className="hero-scene hero-slider" aria-label="Featured food slideshow">
              <div className="hero-slider-stage">
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.src}
                    className={`hero-slide ${index === heroSlide ? 'is-active' : ''}`}
                    aria-hidden={index === heroSlide ? 'false' : 'true'}
                  >
                    <img alt={slide.alt} className="hero-slide-image" src={slide.src} />
                    <div className="hero-slide-scrim"></div>
                    <div className="hero-slide-content">
                      <span>{slide.kicker}</span>
                      <strong>{slide.title}</strong>
                      <p>{slide.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hero-slider-controls">
                <button
                  aria-label="Previous hero image"
                  className="hero-slider-button"
                  type="button"
                  onClick={() => setHeroSlide((current) => (current - 1 + heroSlides.length) % heroSlides.length)}
                >
                  ‹
                </button>
                <button
                  aria-label="Next hero image"
                  className="hero-slider-button"
                  type="button"
                  onClick={() => setHeroSlide((current) => (current + 1) % heroSlides.length)}
                >
                  ›
                </button>
              </div>

              <div className="hero-slider-dots" aria-label="Select hero image">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.src}
                    aria-pressed={index === heroSlide}
                    aria-label={`Show hero image ${index + 1}`}
                    className={index === heroSlide ? 'is-active' : ''}
                    type="button"
                    onClick={() => setHeroSlide(index)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="nav-panel panel">
          <div className="toolbar-actions">
            {!session?.user || (!isAdmin && !isRider) ? (
              <>
                <button
                  className={panel === 'browse' ? 'button button-primary' : 'button button-ghost'}
                  type="button"
                  onClick={() => {
                    setBrowseView('food');
                    setPanel('browse');
                  }}
                >
                  Marketplace
                </button>
               
                  <button
                    className={panel === 'cart' ? 'button button-primary' : 'button button-ghost'}
                    type="button"
                    onClick={() => setPanel('cart')}
                  >
                    Cart
                  </button>
              </>
            ) : isRider ? (
              <button
                className={panel === 'rider' ? 'button button-primary' : 'button button-ghost'}
                type="button"
                onClick={() => setPanel('rider')}
              >
                Rider dashboard
              </button>
            ) : (
              <>
                <button
                  className={panel === 'admin' ? 'button button-primary' : 'button button-ghost'}
                  type="button"
                  onClick={() => setPanel('admin')}
                >
                  Catalog
                </button>
                <button
                  className={panel === 'orders' ? 'button button-primary' : 'button button-ghost'}
                  type="button"
                  onClick={() => setPanel('orders')}
                >
                  Orders
                </button>
              </>
            )}
            {!isAdmin && session?.user ? (
              <button
                className={panel === 'orders' ? 'button button-primary' : 'button button-ghost'}
                type="button"
                onClick={() => setPanel('orders')}
              >
                Orders
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
                  <p className="eyebrow">Marketplace</p>
                  <h3>Browse food and shop merchants in one place</h3>
                </div>
                <span className="muted">Food uses availability. Shops use stock.</span>
              </div>

              <div className="order-tabs">
                <button className={browseView === 'all' ? 'active' : ''} type="button" onClick={() => setBrowseView('all')}>
                  All
                </button>
                <button className={browseView === 'food' ? 'active' : ''} type="button" onClick={() => setBrowseView('food')}>
                  Food
                </button>
                <button className={browseView === 'shops' ? 'active' : ''} type="button" onClick={() => setBrowseView('shops')}>
                  Shops
                </button>
              </div>

              <div className="cards-grid">
                {filteredMerchants.map((merchant) => (
                  <button
                    className={`restaurant-card ${selectedMerchant?.key === merchant.key ? 'active' : ''}`}
                    key={merchant.key}
                    type="button"
                    onClick={() => setSelectedMerchantKey(merchant.key)}
                    style={{ background: colorToCss(merchant.colorHex) }}
                  >
                    {merchant.imageUrl ? (
                      <div className="restaurant-card-image">
                        <img alt={merchant.name} src={merchant.imageUrl} loading="lazy" />
                      </div>
                    ) : null}
                    <div className="restaurant-card-body">
                      <div className="restaurant-card-top">
                        <strong>{merchant.name}</strong>
                        <span>{merchant.type === 'shop' ? 'Shop' : merchant.cuisine}</span>
                      </div>
                      <div className="restaurant-meta">
                        {merchant.type === 'restaurant' ? (
                          <>
                            <span>{merchant.rating} rating</span>
                            <span>{merchant.minutes} min</span>
                            <span>{formatMoney(merchant.deliveryFee)} delivery</span>
                          </>
                        ) : (
                          <>
                            <span>{merchant.items.length} products</span>
                            <span>{merchant.active ? 'Open' : 'Closed'}</span>
                            <span>{formatMoney(merchant.deliveryFee)} shipping</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">
                    {selectedMerchant?.type === 'shop'
                      ? 'Shop items'
                      : selectedMerchant
                        ? 'Restaurant items'
                        : 'Browse items'}
                  </p>
                  <h3>{selectedMerchant ? selectedMerchant.name : 'Select a restaurant or shop'}</h3>
                </div>
                <span className="muted">{selectedMenuItems.length} items</span>
              </div>

              {selectedMerchant ? (
                <div className="menu-panel">
                  {selectedMerchant.type === 'restaurant' && selectedMerchant.imageUrl ? (
                    <div className="selected-restaurant-image">
                      <img alt={selectedMerchant.name} src={selectedMerchant.imageUrl} loading="lazy" />
                    </div>
                  ) : null}
                  <div className="menu-list">
                    {selectedMenuItems.map((item) => {
                      const isShopItem = selectedMerchant.type === 'shop';
                      const stockQty = Number(item.stockQty || 0);
                      const canAdd = !isShopItem || item.trackStock === false || stockQty > 0;
                      return (
                        <article className="menu-item" key={`${selectedMerchant.id}-${item.id}`}>
                          {item.imageUrl ? (
                            <div className="menu-item-image">
                              <img alt={item.name} src={item.imageUrl} loading="lazy" />
                            </div>
                          ) : null}
                          <div className="menu-item-body">
                            <div className="menu-item-head">
                              <strong>{item.name}</strong>
                              <span className="tag">{isShopItem ? 'Product' : item.tag}</span>
                            </div>
                            <p>{item.description}</p>
                            {isShopItem ? (
                              <div className="restaurant-meta">
                                <span>{item.trackStock === false ? 'Unlimited' : `${stockQty} in stock`}</span>
                                <span>{item.category || 'general'}</span>
                              </div>
                            ) : null}
                          </div>
                          <div className="menu-item-actions">
                            <strong>{formatMoney(item.price)}</strong>
                            <button
                              className="button button-primary"
                              disabled={!canAdd}
                              type="button"
                              onClick={() => handleAddToCart(selectedMerchant, item)}
                            >
                              {isShopItem && !canAdd ? 'Out of stock' : 'Add'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="menu-empty-state">
                  <div className="menu-empty-state-art" aria-hidden="true">
                    <div className="menu-empty-state-tap">Select a merchant</div>
                    <div className="menu-empty-state-tile menu-empty-state-tile-large">
                      <img alt="" src="/hero-biryani.png" />
                    </div>
                    <div className="menu-empty-state-tile menu-empty-state-tile-top">
                      <img alt="" src="/hero-burger.png" />
                    </div>
                    <div className="menu-empty-state-tile menu-empty-state-tile-bottom">
                      <img alt="" src="/hero-pasta.png" />
                    </div>
                  </div>
                </div>
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
                  {normalizedCart.items.length ? `${normalizedCart.items.length} items` : 'Cart empty'}
                </span>
              </div>

              <div className="cart-box">
                {normalizedCart.items.map((entry) => (
                  <div className="cart-line" key={entry.item.id}>
                    <div>
                      <strong>{entry.item.name}</strong>
                      <p>
                        {formatMoney(entry.item.price)} {normalizedCart.merchantType === 'shop' ? 'item' : 'meal'}
                      </p>
                    </div>
                    <div className="quantity-controls">
                      <button type="button" onClick={() => updateCartQuantity(entry.item.id, -1)}>
                        -
                      </button>
                      <span>{entry.quantity}</span>
                      <button
                        type="button"
                        disabled={
                          normalizedCart.merchantType === 'shop' &&
                          entry.item.trackStock !== false &&
                          entry.quantity >= Number(entry.item.stockQty || 0)
                        }
                        onClick={() => updateCartQuantity(entry.item.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}

                {normalizedCart.items.length === 0 ? (
                  <div className="empty-state">Add items from Marketplace before placing an order.</div>
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

                  <button className="button button-primary" disabled={busy || !normalizedCart.items.length} type="submit">
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
                            Rider
                            <select
                              disabled={terminalStatuses.has(order.status)}
                              value={orderDrafts[order.id]?.riderId ?? order.riderId ?? ''}
                              onChange={(event) =>
                                setOrderDrafts((current) => ({
                                  ...current,
                                  [order.id]: {
                                    ...(current[order.id] || {}),
                                    riderId: event.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">Select rider</option>
                              {riderUsers.map((rider) => (
                                <option key={rider.id} value={rider.id}>
                                  {rider.name} • {rider.phone}
                                </option>
                              ))}
                            </select>
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

        {panel === 'rider' && session?.user ? (
          <section className="content-single">
            <div className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Assigned orders</p>
                  <h3>Rider dashboard</h3>
                </div>
                <span className="muted">{visibleOrders.length} records</span>
              </div>

              <div className="order-tabs">
                <button
                  className={orderView === 'all' ? 'active' : ''}
                  type="button"
                  onClick={() => setOrderView('all')}
                >
                  All assigned
                </button>
                <button
                  className={orderView === 'today' ? 'active' : ''}
                  type="button"
                  onClick={() => setOrderView('today')}
                >
                  Today
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
                    <div className="order-admin-controls">
                      {order.status === 'riderAssigned' ? (
                        <button
                          className="button button-primary"
                          disabled={busy}
                          type="button"
                          onClick={() => handleRiderStatusUpdate(order.id, 'onTheWay')}
                        >
                          Mark on the way
                        </button>
                      ) : null}
                      {order.status === 'onTheWay' ? (
                        <button
                          className="button button-primary"
                          disabled={busy}
                          type="button"
                          onClick={() => handleRiderStatusUpdate(order.id, 'delivered')}
                        >
                          Mark delivered
                        </button>
                      ) : null}
                      <button
                        className="button button-ghost"
                        disabled={busy}
                        type="button"
                        onClick={() => handleRiderIssue(order.id)}
                      >
                        Report issue
                      </button>
                    </div>
                    <div className="order-total">
                      <span>Assigned rider</span>
                      <span>
                        {order.riderName || session.user.name}
                        {order.riderPhone ? ` • ${order.riderPhone}` : ''}
                      </span>
                    </div>
                    {Array.isArray(order.history) && order.history.length ? (
                      <details className="order-history">
                        <summary>Status history</summary>
                        <div className="order-history-list">
                          {order.history.map((entry, index) => (
                            <div key={`${order.id}-history-${index}`} className="order-history-item">
                              <strong>{entry.status || 'Note'}</strong>
                              <span>{entry.note || entry.actorRole || 'Update'}</span>
                              <small>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}</small>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </article>
                ))}
                {visibleOrders.length === 0 ? <div className="empty-state">No assigned orders found.</div> : null}
              </div>
            </div>
          </section>
        ) : null}

        {panel === 'admin' && isAdmin ? (
          <section className="admin-console">
            <aside className="panel admin-sidebar">
              <div className="admin-sidebar-head">
                <p className="eyebrow">Control room</p>
                <h3>Admin console</h3>
                <p className="muted">Manage orders, restaurants, and shops from one workspace.</p>
              </div>

              <div className="admin-sidebar-nav">
                <button
                  className={adminSection === 'dashboard' ? 'active' : ''}
                  type="button"
                  onClick={() => setAdminSection('dashboard')}
                >
                  Dashboard
                </button>
                <button
                  className={adminSection === 'orders' ? 'active' : ''}
                  type="button"
                  onClick={() => setAdminSection('orders')}
                >
                  Orders
                </button>
                <button
                  className={adminSection === 'restaurants' ? 'active' : ''}
                  type="button"
                  onClick={() => setAdminSection('restaurants')}
                >
                  Restaurants
                </button>
                <button
                  className={adminSection === 'shops' ? 'active' : ''}
                  type="button"
                  onClick={() => setAdminSection('shops')}
                >
                  Shops
                </button>
                <button
                  className={adminSection === 'inventory' ? 'active' : ''}
                  type="button"
                  onClick={() => setAdminSection('inventory')}
                >
                  Inventory
                </button>
                <button
                  className={adminSection === 'users' ? 'active' : ''}
                  type="button"
                  onClick={() => setAdminSection('users')}
                >
                  Users
                </button>
              </div>

              <div className="admin-sidebar-foot">
                <div>
                  <strong>{activeOrdersCount}</strong>
                  <span>active orders</span>
                </div>
                <div>
                  <strong>{totalCatalogItems}</strong>
                  <span>catalog items</span>
                </div>
              </div>
            </aside>

            <div className="admin-main">
              <div className="admin-kpis">
                <div className="admin-kpi-card">
                  <span>Pending</span>
                  <strong>{pendingOrdersCount}</strong>
                </div>
                <div className="admin-kpi-card">
                  <span>Active</span>
                  <strong>{activeOrdersCount}</strong>
                </div>
                <div className="admin-kpi-card">
                  <span>Restaurants</span>
                  <strong>{restaurantCount}</strong>
                </div>
                <div className="admin-kpi-card">
                  <span>Shops</span>
                  <strong>{shopCount}</strong>
                </div>
                <div className="admin-kpi-card">
                  <span>Items</span>
                  <strong>{totalCatalogItems}</strong>
                </div>
              </div>

              {adminSection === 'dashboard' ? (
                <div className="admin-dashboard-grid">
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Recent orders</p>
                        <h3>Compact order feed</h3>
                      </div>
                      <button className="button button-ghost" type="button" onClick={() => setAdminSection('orders')}>
                        Open orders
                      </button>
                    </div>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Merchant</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {normalizedOrders.slice(0, 6).map((order) => (
                            <tr key={order.id}>
                              <td>
                                <strong>{order.id}</strong>
                              </td>
                              <td>{order.restaurantName}</td>
                              <td>{order.customerName}</td>
                              <td>
                                <span className={statusClass(order.status)}>{statusLabels[order.status]}</span>
                              </td>
                              <td>{formatMoney(order.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Overview</p>
                        <h3>Merchant snapshot</h3>
                      </div>
                    </div>
                    <div className="admin-overview-list">
                      <div>
                        <span>Pending orders</span>
                        <strong>{pendingOrdersCount}</strong>
                      </div>
                      <div>
                        <span>Restaurants</span>
                        <strong>{restaurantCount}</strong>
                      </div>
                      <div>
                        <span>Shops</span>
                        <strong>{shopCount}</strong>
                      </div>
                      <div>
                        <span>Catalog items</span>
                        <strong>{totalCatalogItems}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {adminSection === 'orders' ? (
                <div className="panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Orders</p>
                      <h3>Compact order table</h3>
                    </div>
                    <div className="order-tabs order-tabs-inline">
                      <button className={orderView === 'all' ? 'active' : ''} type="button" onClick={() => setOrderView('all')}>
                        All
                      </button>
                      <button className={orderView === 'today' ? 'active' : ''} type="button" onClick={() => setOrderView('today')}>
                        Today
                      </button>
                    </div>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table admin-table-orders">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Merchant</th>
                          <th>Customer</th>
                          <th>Phone</th>
                          <th>Items</th>
                          <th>Status</th>
                          <th>Total</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOrders.map((order) => (
                          <tr key={order.id}>
                            <td>{order.id}</td>
                            <td>{order.restaurantName}</td>
                            <td>{order.customerName}</td>
                            <td>{order.phone}</td>
                            <td>{normalizeOrders(order.lines).reduce((sum, line) => sum + Number(line.quantity || 0), 0)}</td>
                            <td>
                              {isAdmin ? (
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
                              ) : (
                                <span className={statusClass(order.status)}>{statusLabels[order.status]}</span>
                              )}
                            </td>
                            <td>{formatMoney(order.total)}</td>
                            <td>
                              <div className="admin-table-actions">
                                <select
                                  disabled={terminalStatuses.has(order.status)}
                                  value={orderDrafts[order.id]?.riderId ?? order.riderId ?? ''}
                                  onChange={(event) =>
                                    setOrderDrafts((current) => ({
                                      ...current,
                                      [order.id]: {
                                        ...(current[order.id] || {}),
                                        riderId: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Select rider</option>
                                  {riderUsers.map((rider) => (
                                    <option key={rider.id} value={rider.id}>
                                      {rider.name} • {rider.phone}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="button button-primary"
                                  disabled={busy || terminalStatuses.has(order.status)}
                                  type="button"
                                  onClick={() => handleStatusSave(order.id)}
                                >
                                  Save
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {adminSection === 'restaurants' ? (
                <div className="admin-split">
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
                      <label className="image-upload">
                        Restaurant image
                        <input
                          accept="image/*"
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void setRestaurantImage(file);
                            }
                          }}
                        />
                        {restaurantForm.imageUrl ? (
                          <div className="image-preview">
                            <img alt="Restaurant preview" src={restaurantForm.imageUrl} />
                          </div>
                        ) : null}
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
                            <label className="image-upload">
                              Item image
                              <input
                                accept="image/*"
                                type="file"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) {
                                    void setMenuImage(index, file);
                                  }
                                }}
                              />
                              {item.imageUrl ? (
                                <div className="image-preview image-preview-small">
                                  <img alt={`${item.name || 'Menu item'} preview`} src={item.imageUrl} />
                                </div>
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
                                <button className="button button-ghost" type="button" onClick={addMenuRow}>
                                  Add row
                                </button>
                                <button className="button button-ghost" type="button" onClick={() => removeMenuRow(index)}>
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
                        <p className="eyebrow">Existing restaurants</p>
                        <h3>Edit or delete restaurants</h3>
                      </div>
                      <span className="muted">{restaurants.length} records</span>
                    </div>
                    <div className="restaurant-list">
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
                    </div>
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
              ) : null}

              {adminSection === 'shops' ? (
                <div className="admin-split">
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Shop editor</p>
                        <h3>{editingShopId ? 'Edit shop' : 'Create shop'}</h3>
                      </div>
                      <button className="button button-ghost" type="button" onClick={resetShopForm}>
                        New
                      </button>
                    </div>

                    <form className="stack" onSubmit={handleShopSubmit}>
                      <div className="two-col">
                        <label>
                          Name
                          <input
                            aria-invalid={shopErrors.name ? 'true' : 'false'}
                            value={shopForm.name}
                            onChange={(event) => setShopField('name', event.target.value)}
                          />
                          {shopErrors.name ? <span className="field-error">{shopErrors.name}</span> : null}
                        </label>
                        <label>
                          Active
                          <select
                            value={shopForm.active ? 'yes' : 'no'}
                            onChange={(event) => setShopField('active', event.target.value === 'yes')}
                          >
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Description
                        <input
                          value={shopForm.description}
                          onChange={(event) => setShopField('description', event.target.value)}
                          placeholder="Marketplace shop description"
                        />
                      </label>
                      <div className="three-col">
                        <label>
                          Delivery fee
                          <input
                            aria-invalid={shopErrors.deliveryFee ? 'true' : 'false'}
                            type="number"
                            value={shopForm.deliveryFee}
                            onChange={(event) => setShopField('deliveryFee', event.target.value)}
                          />
                          {shopErrors.deliveryFee ? <span className="field-error">{shopErrors.deliveryFee}</span> : null}
                        </label>
                        <label>
                          Color
                          <input
                            aria-invalid={shopErrors.colorHex ? 'true' : 'false'}
                            value={shopForm.colorHex}
                            onChange={(event) => setShopField('colorHex', event.target.value)}
                          />
                          {shopErrors.colorHex ? <span className="field-error">{shopErrors.colorHex}</span> : null}
                        </label>
                        <label className="image-upload">
                          Shop image
                          <input
                            accept="image/*"
                            type="file"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) {
                                void setShopImage(file);
                              }
                            }}
                          />
                          {shopForm.imageUrl ? (
                            <div className="image-preview">
                              <img alt="Shop preview" src={shopForm.imageUrl} />
                            </div>
                          ) : null}
                        </label>
                      </div>

                      <div className="menu-editor">
                        <div className="menu-editor-head">
                          <strong>Products</strong>
                        </div>

                        {shopForm.products.map((product, index) => (
                          <div className="menu-row" key={index}>
                            <div className="two-col">
                              <label>
                                Product name
                                <input
                                  aria-invalid={shopErrors.products?.[index]?.name ? 'true' : 'false'}
                                  value={product.name}
                                  onChange={(event) => setShopProductField(index, 'name', event.target.value)}
                                />
                                {shopErrors.products?.[index]?.name ? (
                                  <span className="field-error">{shopErrors.products[index].name}</span>
                                ) : null}
                              </label>
                              <label>
                                Category
                                <input
                                  value={product.category}
                                  onChange={(event) => setShopProductField(index, 'category', event.target.value)}
                                />
                              </label>
                            </div>
                            <label>
                              Description
                              <input
                                aria-invalid={shopErrors.products?.[index]?.description ? 'true' : 'false'}
                                value={product.description}
                                onChange={(event) => setShopProductField(index, 'description', event.target.value)}
                              />
                              {shopErrors.products?.[index]?.description ? (
                                <span className="field-error">{shopErrors.products[index].description}</span>
                              ) : null}
                            </label>
                            <label className="image-upload">
                              Product image
                              <input
                                accept="image/*"
                                type="file"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) {
                                    void setShopProductImage(index, file);
                                  }
                                }}
                              />
                              {product.imageUrl ? (
                                <div className="image-preview image-preview-small">
                                  <img alt={`${product.name || 'Product'} preview`} src={product.imageUrl} />
                                </div>
                              ) : null}
                            </label>
                            <div className="menu-row-bottom">
                              <label>
                                Price
                                <input
                                  aria-invalid={shopErrors.products?.[index]?.price ? 'true' : 'false'}
                                  type="number"
                                  value={product.price}
                                  onChange={(event) => setShopProductField(index, 'price', event.target.value)}
                                />
                                {shopErrors.products?.[index]?.price ? (
                                  <span className="field-error">{shopErrors.products[index].price}</span>
                                ) : null}
                              </label>
                              <label>
                                Stock
                                <input
                                  aria-invalid={shopErrors.products?.[index]?.stockQty ? 'true' : 'false'}
                                  type="number"
                                  value={product.stockQty}
                                  onChange={(event) => setShopProductField(index, 'stockQty', event.target.value)}
                                  disabled={product.trackStock === false}
                                />
                                {shopErrors.products?.[index]?.stockQty ? (
                                  <span className="field-error">{shopErrors.products[index].stockQty}</span>
                                ) : null}
                              </label>
                              <label className="checkbox-row">
                                <input
                                  checked={product.trackStock !== false}
                                  type="checkbox"
                                  onChange={(event) => setShopProductField(index, 'trackStock', event.target.checked)}
                                />
                                Track stock
                              </label>
                              <div className="row-actions">
                                <button className="button button-ghost" type="button" onClick={addShopProductRow}>
                                  Add row
                                </button>
                                <button className="button button-ghost" type="button" onClick={() => removeShopProductRow(index)}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button className="button button-primary" disabled={busy} type="submit">
                        {editingShopId ? 'Update shop' : 'Create shop'}
                      </button>
                    </form>
                  </div>

                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Existing shops</p>
                        <h3>Edit or delete shops</h3>
                      </div>
                      <span className="muted">{shops.length} records</span>
                    </div>
                    <div className="restaurant-list">
                      {shops.map((shop) => (
                        <article className="admin-restaurant-row" key={shop.id}>
                          <div>
                            <span>{shop.name}</span>
                            <small>{(shop.products || []).length} products</small>
                          </div>
                          <div className="restaurant-row-actions">
                            <button className="button button-ghost" type="button" onClick={() => openShopEditor(shop)}>
                              Edit
                            </button>
                            <button
                              className="button button-danger"
                              disabled={busy}
                              type="button"
                              onClick={() => handleDeleteShop(shop)}
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {shops.length === 0 ? <div className="empty-state">No shops found.</div> : null}
                  </div>
                </div>
              ) : null}

              {adminSection === 'inventory' ? (
                <div className="panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Inventory</p>
                      <h3>Live stock editor</h3>
                    </div>
                    <span className="muted">{filteredInventoryItems.length} records</span>
                  </div>

                  <div className="toolbar-actions">
                    <input
                      value={inventorySearch}
                      onChange={(event) => setInventorySearch(event.target.value)}
                      placeholder="Search merchant or item"
                    />
                  </div>

                  <div className="admin-table-wrap">
                    <table className="admin-table admin-table-inventory">
                      <thead>
                        <tr>
                          <th>Merchant</th>
                          <th>Item</th>
                          <th>Stock</th>
                          <th>Updated</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventoryItems.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.merchant_name}</strong>
                              <div className="muted">{row.merchant_type}</div>
                            </td>
                            <td>{row.item_name}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                value={inventoryDrafts[row.id] ?? row.stock_qty}
                                onChange={(event) =>
                                  setInventoryDrafts((current) => ({
                                    ...current,
                                    [row.id]: event.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="muted">
                              {row.updated_at ? new Date(row.updated_at).toLocaleString() : '-'}
                            </td>
                            <td>
                              <button
                                className="button button-primary"
                                disabled={busy}
                                type="button"
                                onClick={() => handleInventorySave(row.id)}
                              >
                                Save
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {filteredInventoryItems.length === 0 ? (
                    <div className="empty-state">No inventory items found.</div>
                  ) : null}
                </div>
              ) : null}

              {adminSection === 'users' ? (
                <div className="admin-split">
                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">User editor</p>
                        <h3>Add new user</h3>
                      </div>
                      <button className="button button-ghost" type="button" onClick={resetUserForm}>
                        Clear
                      </button>
                    </div>

                    <form className="stack" onSubmit={handleUserSubmit}>
                      <div className="two-col">
                        <label>
                          Name
                          <input
                            aria-invalid={userErrors.name ? 'true' : 'false'}
                            value={userForm.name}
                            onChange={(event) => setUserField('name', event.target.value)}
                            placeholder="Full name"
                          />
                          {userErrors.name ? <span className="field-error">{userErrors.name}</span> : null}
                        </label>
                        <label>
                          Role
                          <select value={userForm.role} onChange={(event) => setUserField('role', event.target.value)}>
                            <option value="rider">Rider</option>
                            <option value="regionalAdmin">Regional admin</option>
                            <option value="other">Other</option>
                            <option value="customer">Customer</option>
                          </select>
                        </label>
                      </div>

                      <div className="two-col">
                        <label>
                          Mobile number
                          <input
                            aria-invalid={userErrors.phone ? 'true' : 'false'}
                            value={userForm.phone}
                            onChange={(event) => setUserField('phone', event.target.value)}
                            placeholder="01xxxxxxxxx"
                          />
                          {userErrors.phone ? <span className="field-error">{userErrors.phone}</span> : null}
                        </label>
                        <label>
                          NID
                          <input
                            aria-invalid={userErrors.nid ? 'true' : 'false'}
                            value={userForm.nid}
                            onChange={(event) => setUserField('nid', event.target.value)}
                            placeholder="10, 13, or 17 digits"
                          />
                          {userErrors.nid ? <span className="field-error">{userErrors.nid}</span> : null}
                        </label>
                      </div>

                      <div className="two-col">
                        <label>
                          Email
                          <input
                            aria-invalid={userErrors.email ? 'true' : 'false'}
                            value={userForm.email}
                            onChange={(event) => setUserField('email', event.target.value)}
                            placeholder="Optional"
                          />
                          {userErrors.email ? <span className="field-error">{userErrors.email}</span> : null}
                        </label>
                        <label>
                          Address
                          <input
                            value={userForm.address}
                            onChange={(event) => setUserField('address', event.target.value)}
                            placeholder="Optional"
                          />
                        </label>
                      </div>

                      <button className="button button-primary" disabled={busy} type="submit">
                        Create user
                      </button>
                    </form>

                    {userCreatedCredentials ? (
                      <div className="alert alert-success" style={{ marginTop: 16 }}>
                        <strong>{userCreatedCredentials.name}</strong>
                        <div>Mobile: {userCreatedCredentials.phone}</div>
                        <div>Temporary password: {userCreatedCredentials.temporaryPassword}</div>
                      </div>
                    ) : null}
                  </div>

                  <div className="panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Existing users</p>
                        <h3>Active accounts</h3>
                      </div>
                      <span className="muted">{users.length} records</span>
                    </div>

                    <div className="restaurant-list">
                      {users.map((user) => (
                        <article className="admin-restaurant-row" key={user.id}>
                          <div>
                            <span>
                              {user.name} <small>{formatUserRole(user.role)}</small>
                            </span>
                            <small>
                              {user.phone}
                              {user.nid ? ` • NID ${user.nid}` : ''}
                            </small>
                          </div>
                          <div className="restaurant-row-actions">
                            <span className="muted">{user.email || 'No email'}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                    {users.length === 0 ? <div className="empty-state">No users found.</div> : null}
                  </div>
                </div>
              ) : null}
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
                      setShowSignInPassword(false);
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
                    Mobile number
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
                    <div className="password-field">
                      <input
                        type={showSignInPassword ? 'text' : 'password'}
                        value={signInForm.password}
                        aria-invalid={authFieldErrors.password ? 'true' : 'false'}
                        onChange={(event) => {
                          setAuthError('');
                          setAuthFieldErrors((current) => ({ ...current, password: '' }));
                          setSignInForm((current) => ({ ...current, password: event.target.value }));
                        }}
                        placeholder="Password"
                      />
                      <button
                        className="password-toggle"
                        type="button"
                        aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showSignInPassword}
                        onClick={() => setShowSignInPassword((current) => !current)}
                      >
                        {showSignInPassword ? (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3.5 12s3.1-6 8.5-6 8.5 6 8.5 6-3.1 6-8.5 6-8.5-6-8.5-6Zm8.5 3.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm0-1.8A1.7 1.7 0 1 1 12 9.9a1.7 1.7 0 0 1 0 3.4Z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2.5 12s3.1-6 9.5-6c1.1 0 2.1.2 3 .4l1.5-1.5 1.4 1.4-14 14-1.4-1.4 2.1-2.1C3.7 15.5 2.5 12 2.5 12Zm7.1 0a2.4 2.4 0 0 0 3.9 1.9l-3.3-3.3A2.4 2.4 0 0 0 9.6 12Zm2.4-4.3c-3.9 0-6.2 2.7-7.1 4.3.4.7 1.1 1.8 2.1 2.7l1.2-1.2a4.1 4.1 0 0 1 5.4-5.4l1.2-1.2c-.9-.2-1.8-.2-2.8-.2Zm6.5 1.9-1.5 1.5c.5.7.8 1.3 1 1.9-.4.7-1.1 1.8-2.1 2.7a10 10 0 0 1-2.1 1.5l1.4 1.4c1.5-.8 3.1-2.1 4.8-4.5-.5-1-1.4-2.6-3.5-4.5Z" />
                          </svg>
                        )}
                      </button>
                    </div>
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
                    Mobile number
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

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-brand">
            <p className="eyebrow">KD Easy Life</p>
            <h3>Fresh food, faster checkout.</h3>
            <p>
              Browse restaurants, save your favorites, and complete orders from one simple delivery
              dashboard.
            </p>
          </div>

          <div className="footer-grid">
            <div className="footer-column">
              <h4>Contact Us</h4>
              <p>House 114/2, Khilkhet, Dhaka, Bangladesh</p>
              <a href="tel:+8801824800800">01762-849868</a>
              <a href="mailto:support@kdeasylife.com">support@kdeasylife.com</a>
              <span>Support hours: 24/7</span>
            </div>

            <div className="footer-column">
              <h4>Help Center</h4>
              <span>About this app</span>
              <span>Delivery policy</span>
              <span>Refund policy</span>
              <span>Privacy policy</span>
              <span>Terms and conditions</span>
            </div>

            <div className="footer-column">
              <h4>Quick Links</h4>
              <span>Browse restaurants</span>
              <span>Track orders</span>
              <span>My cart</span>
              <span>Sign in</span>
              <span>Checkout</span>
            </div>

            <div className="footer-column">
              <h4>Follow Us</h4>
              <div className="footer-socials" aria-label="Social links">
                <span>FB</span>
                <span>IG</span>
                <span>YT</span>
                <span>WA</span>
              </div>
              <h4 className="footer-payments-title">Payments</h4>
              <div className="footer-payments" aria-label="Accepted payment methods">
                <span>Visa</span>
                <span>Mastercard</span>
                <span>bKash</span>
                <span>Nagad</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>Copyright 2026 KD Easy Life. All rights reserved.</p>
            <p>Trade license: TRAD/DNCC/093574/2022</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
