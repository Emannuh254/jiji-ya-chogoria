// 🌙 Dark/Light Mode Toggle Button Script
        (() => {
        const THEME_KEY = "darkLightMode";
        const btn = document.getElementById("darkLightToggleBtn");

        // 💅 Base styles
        Object.assign(btn.style, {
            position: "fixed",
            bottom: "12px",
            right: "12px",
            zIndex: 9999,
            background: "var(--accent-gradient, linear-gradient(135deg, #6a5acd, #483d8b))",
            border: "none",
            borderRadius: "50%",
            width: "20px",
            height: "22px",
            color: "#fff",
            fontSize: "1rem",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            transition: "transform 0.2s ease, background 0.3s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
        });

        btn.onmouseenter = () => (btn.style.transform = "scale(1.1)");
        btn.onmouseleave = () => (btn.style.transform = "scale(1)");
        btn.onkeydown = (e) => e.key === "Enter" && btn.click(); // accessibility

        // 🌓 Detect and apply theme
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const saved = localStorage.getItem(THEME_KEY);
        let darkMode = saved ? saved === "dark" : prefersDark;

        const applyTheme = () => {
            document.body.classList.toggle("light-mode", !darkMode);
            btn.innerHTML = darkMode ? "☀️" : "🌙";
            btn.setAttribute("aria-label", darkMode ? "Switch to light mode" : "Switch to dark mode");
            localStorage.setItem(THEME_KEY, darkMode ? "dark" : "light");
        };

        applyTheme();

        // 🔁 Toggle mode
        btn.onclick = () => {
            darkMode = !darkMode;
            applyTheme();
        };

        // 🧭 Optional: auto place in nav/header if found
        const navbar = document.querySelector("nav, header");
        if (navbar) {
            navbar.appendChild(btn);
            Object.assign(btn.style, {
            position: "absolute",
            top: "80px",
            right: "5%",
            bottom: "auto",
            });
        }
        })();
        




    
        // Initialize Supabase
        const supabaseUrl = 'https://lrezerxsbuekkhmpverr.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyZXplcnhzYnVla2tobXB2ZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNTI3MjMsImV4cCI6MjA3MzkyODcyM30.96senppPRMHveFi2ouDPDqhh17XIwxsLvA4U0rvjU9g';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const navLinks = document.querySelector('.nav-links');

        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        // Close mobile menu when clicking on a link
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });

        // Toast notification function
        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            // Add icon based on type
            if (type === 'success') {
                toast.innerHTML = `<span>✅</span> <span>${message}</span>`;
            } else if (type === 'error') {
                toast.innerHTML = `<span>❌</span> <span>${message}</span>`;
            } else if (type === 'warning') {
                toast.innerHTML = `<span>⚠️</span> <span>${message}</span>`;
            } else {
                toast.textContent = message;
            }
            
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), 3000);
        }

        // Check authentication and ensure profile exists
        async function checkAuth() {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (!user) {
                showToast('Please log in to access the dashboard 😕', 'error');
                window.location.href = 'index.html';
                return null;
            }

            // Check if profile exists
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('id', user.id)
                .single();

            if (profileError || !profile) {
                // Create profile if it doesn't exist
                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        full_name: user.user_metadata?.full_name || user.email
                    }]);
                if (insertError) {
                    console.error('Error creating profile:', insertError);
                    showToast('Error setting up profile 😕', 'error');
                }
            }

            document.getElementById('user-name').textContent =
                `Welcome, ${user.user_metadata?.full_name || user.email} 👋`;
            return user;
        }

        // Load products
        async function loadProducts(statusFilter = 'all') {
            const productsList = document.getElementById('products-list');
            productsList.innerHTML = '<div class="loading-spinner">Loading products...</div>';

            try {
                let query = supabase
                    .from('products')
                    .select(`
                        id,
                        title,
                        description,
                        price,
                        status,
                        image_url,
                        created_at,
                        user_id,
                        profiles!products_user_id_fkey(full_name)
                    `)
                    .order('created_at', { ascending: false });

                // Apply status filter if not 'all'
                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Error loading products:', error);
                    productsList.innerHTML = `<div class="error-message">⚠️ ${error.message}</div>`;
                    showToast('Error loading products 😕', 'error');
                    return;
                }

                productsList.innerHTML = '';

                if (!data || data.length === 0) {
                    productsList.innerHTML = '<div class="no-products">No products available yet</div>';
                    return;
                }

                // Process each product
                for (const product of data) {
                    const productCard = await createProductCard(product);
                    productsList.appendChild(productCard);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
                productsList.innerHTML = '<div class="error-message">Unexpected error while loading products 😕</div>';
                showToast('Unexpected error occurred 😕', 'error');
            }
        }

        // Create a product card
        async function createProductCard(product) {
            const statusClass = product.status === 'in_stock'
                ? 'in-stock'
                : product.status === 'sold'
                    ? 'sold'
                    : 'reserved';

            // Process image URLs - handle single image or multiple images
            let images = [];
            if (product.image_url) {
                // Check if it's a single image or multiple (comma-separated)
                if (product.image_url.includes(',')) {
                    images = product.image_url.split(',').map(url => url.trim());
                } else {
                    images = [product.image_url];
                }
            }

            // Get likes count
            const { data: likesData, error: likesError } = await supabase
                .from('likes')
                .select('*', { count: 'exact' })
                .eq('product_id', product.id);

            const likesCount = likesError ? 0 : likesData.length;

            // Get comments count
            const { data: commentsData, error: commentsError } = await supabase
                .from('comments')
                .select('*', { count: 'exact' })
                .eq('product_id', product.id);

            const commentsCount = commentsError ? 0 : commentsData.length;

            // Create image gallery HTML
            let galleryHtml = '';
            if (images.length > 0) {
                galleryHtml = `
                    <div class="product-gallery">
                        <div class="product-image-container" data-current="0" data-images='${JSON.stringify(images)}'>
                            ${images.map((img, index) => `
                                <img src="${img}" alt="${product.title}" class="product-image" loading="lazy" 
                                    onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">
                            `).join('')}
                        </div>
                        ${images.length > 1 ? `
                            <button class="product-nav prev" onclick="changeImage(this, -1)">❮</button>
                            <button class="product-nav next" onclick="changeImage(this, 1)">❯</button>
                            <div class="product-image-indicators">
                                ${images.map((_, index) => `
                                    <div class="indicator ${index === 0 ? 'active' : ''}" 
                                        onclick="goToImage(this, ${index})"></div>
                                `).join('')}
                            </div>
                        ` : ''}
                        <div class="product-overlay"></div>
                    </div>
                `;
            } else {
                galleryHtml = `
                    <div class="product-gallery no-image">
                        <div class="no-image-placeholder">📷</div>
                        <div class="product-overlay"></div>
                    </div>
                `;
            }

            const productEl = document.createElement('div');
            productEl.className = 'product-card';
            productEl.setAttribute('data-status', product.status);
            productEl.setAttribute('data-product-id', product.id);
            
            productEl.innerHTML = `
                ${galleryHtml}
                <div class="product-content">
                    <div class="product-header">
                        <div class="seller-info">
                            <div class="seller-avatar">${product.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}</div>
                            <div class="seller-details">
                                <div class="seller-name">${product.profiles?.full_name || 'Unknown'}</div>
                                <div class="product-time">${formatPostTime(product.created_at)}</div>
                            </div>
                        </div>
                        <div class="status-indicator ${statusClass}">
                            ${product.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                        </div>
                    </div>
                    
                    <div class="product-body">
                        <h3 class="product-title">${product.title}</h3>
                        <p class="product-description">${product.description || 'No description provided.'}</p>
                    </div>
                    
                    <div class="product-actions">
                        <div class="product-price">KES ${product.price || 'N/A'}</div>
                        <button class="chat-seller-btn"
                            data-seller-id="${product.user_id}"
                            data-seller-name="${product.profiles?.full_name || 'Seller'}"
                            data-product-title="${product.title}">
                            💬 Chat seller 
                        </button>
                    </div>
                    
                    <div class="product-social">
                        <div class="like-section">
                            <button class="like-btn" data-product-id="${product.id}">
                                <span class="like-icon">❤️</span>
                                <span class="like-count">${likesCount}</span>
                            </button>
                        </div>
                        <button class="comment-btn" data-product-id="${product.id}">
                            <span class="comment-icon">💬</span>
                            <span class="comment-count">${commentsCount}</span>
                        </button>
                        <button class="report-btn" data-product-id="${product.id}" data-seller-id="${product.user_id}">
                            <span class="report-icon">🚩</span>
                            Report
                        </button>
                    </div>
                    
                    <div class="comments-section" id="comments-${product.id}">
                        <div class="comment-form">
                            <textarea class="comment-input" placeholder="Add a comment..." data-product-id="${product.id}"></textarea>
                            <button class="comment-submit" data-product-id="${product.id}">Post</button>
                        </div>
                        <div class="comments-list" id="comments-list-${product.id}">
                            <!-- Comments will be loaded here -->
                        </div>
                    </div>
                </div>
            `;

            // Add event listeners
            const likeBtn = productEl.querySelector('.like-btn');
            likeBtn.addEventListener('click', function() {
                toggleLike(this, product.id);
            });

            const commentBtn = productEl.querySelector('.comment-btn');
            commentBtn.addEventListener('click', function() {
                toggleComments(product.id);
            });

            const reportBtn = productEl.querySelector('.report-btn');
            reportBtn.addEventListener('click', function() {
                openReportModal(product.id, product.user_id);
            });

            const commentSubmit = productEl.querySelector('.comment-submit');
            commentSubmit.addEventListener('click', function() {
                const commentInput = productEl.querySelector('.comment-input');
                submitComment(product.id, commentInput.value);
                commentInput.value = '';
            });

            // Add event listener for image gallery
            const gallery = productEl.querySelector('.product-gallery');
            gallery.addEventListener('click', function(e) {
                // Don't open modal if clicking on nav buttons or indicators
                if (e.target.classList.contains('product-nav') || 
                    e.target.classList.contains('indicator')) {
                    return;
                }
                
                const container = this.querySelector('.product-image-container');
                if (container) {
                    const images = JSON.parse(container.dataset.images);
                    const currentIndex = parseInt(container.dataset.current);
                    openImageModal(images, currentIndex);
                }
            });

            // Add event listener for chat button
            const chatBtn = productEl.querySelector('.chat-seller-btn');
            chatBtn.addEventListener('click', function() {
                const sellerId = this.dataset.sellerId;
                const sellerName = this.dataset.sellerName;
                const productTitle = this.dataset.productTitle;

                sessionStorage.setItem('chatSellerId', sellerId);
                sessionStorage.setItem('chatSellerName', sellerName);
                sessionStorage.setItem('chatProductTitle', productTitle);

                window.location.href = 'chat.html';
            });

            return productEl;
        }

        // Toggle like on a product
        async function toggleLike(button, productId) {
            const user = await checkAuth();
            if (!user) return;

            const likeIcon = button.querySelector('.like-icon');
            const likeCount = button.querySelector('.like-count');
            const currentCount = parseInt(likeCount.textContent);
            
            // Check if user already liked this product
            const { data: existingLike, error: checkError } = await supabase
                .from('likes')
                .select('*')
                .eq('user_id', user.id)
                .eq('product_id', productId)
                .single();

            if (existingLike) {
                // Unlike the product
                const { error: deleteError } = await supabase
                    .from('likes')
                    .delete()
                    .eq('id', existingLike.id);
                
                if (deleteError) {
                    console.error('Error unliking product:', deleteError);
                    showToast('Error unliking product 😕', 'error');
                    return;
                }
                
                button.classList.remove('liked');
                likeCount.textContent = Math.max(0, currentCount - 1);
            } else {
                // Like the product
                const { error: insertError } = await supabase
                    .from('likes')
                    .insert([{
                        user_id: user.id,
                        product_id: productId
                    }]);
                
                if (insertError) {
                    console.error('Error liking product:', insertError);
                    showToast('Error liking product 😕', 'error');
                    return;
                }
                
                button.classList.add('liked');
                likeCount.textContent = currentCount + 1;
            }
        }

        // Toggle comments section
        function toggleComments(productId) {
            const commentsSection = document.getElementById(`comments-${productId}`);
            commentsSection.classList.toggle('active');
            
            // Load comments if section is opened and empty
            if (commentsSection.classList.contains('active')) {
                const commentsList = document.getElementById(`comments-list-${productId}`);
                if (commentsList.children.length === 0) {
                    loadComments(productId);
                }
            }
        }

        // Load comments for a product
        async function loadComments(productId) {
            const commentsList = document.getElementById(`comments-list-${productId}`);
            commentsList.innerHTML = '<div class="loading-spinner">Loading comments...</div>';
            
            try {
                const { data: comments, error } = await supabase
                    .from('comments')
                    .select(`
                        id,
                        content,
                        created_at,
                        user_id,
                        profiles!comments_user_id_fkey(full_name)
                    `)
                    .eq('product_id', productId)
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error('Error loading comments:', error);
                    commentsList.innerHTML = '<div class="error-message">Error loading comments</div>';
                    return;
                }
                
                commentsList.innerHTML = '';
                
                if (comments.length === 0) {
                    commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first to comment!</div>';
                    return;
                }
                
                comments.forEach(comment => {
                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment';
                    commentEl.innerHTML = `
                        <div class="comment-avatar">${comment.profiles?.full_name?.charAt(0).toUpperCase() || 'U'}</div>
                        <div class="comment-content">
                            <div class="comment-header">
                                <div class="comment-author">${comment.profiles?.full_name || 'Unknown'}</div>
                                <div class="comment-time">${formatPostTime(comment.created_at)}</div>
                            </div>
                            <div class="comment-text">${comment.content}</div>
                        </div>
                    `;
                    commentsList.appendChild(commentEl);
                });
            } catch (err) {
                console.error('Unexpected error loading comments:', err);
                commentsList.innerHTML = '<div class="error-message">Unexpected error loading comments</div>';
            }
        }

        // Submit a comment
        async function submitComment(productId, content) {
            if (!content.trim()) {
                showToast('Please enter a comment 😕', 'error');
                return;
            }
            
            const user = await checkAuth();
            if (!user) return;
            
            try {
                const { error } = await supabase
                    .from('comments')
                    .insert([{
                        user_id: user.id,
                        product_id: productId,
                        content: content
                    }]);
                
                if (error) {
                    console.error('Error submitting comment:', error);
                    showToast('Error submitting comment 😕', 'error');
                    return;
                }
                
                showToast('Comment posted successfully! 🎉', 'success');
                
                // Reload comments
                loadComments(productId);
                
                // Update comment count
                const commentBtn = document.querySelector(`.comment-btn[data-product-id="${productId}"]`);
                const commentCount = commentBtn.querySelector('.comment-count');
                commentCount.textContent = parseInt(commentCount.textContent) + 1;
            } catch (err) {
                console.error('Unexpected error submitting comment:', err);
                showToast('Unexpected error submitting comment 😕', 'error');
            }
        }

        // Open report modal
        function openReportModal(productId, sellerId) {
            const modal = document.getElementById('report-modal');
            modal.style.display = 'block';
            
            // Set product ID in the form
            const form = document.getElementById('report-form');
            form.setAttribute('data-product-id', productId);
            form.setAttribute('data-seller-id', sellerId);
        }

        // Submit report
        document.getElementById('report-form')?.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const productId = this.getAttribute('data-product-id');
            const sellerId = this.getAttribute('data-seller-id');
            const reason = document.getElementById('report-reason').value;
            const details = document.getElementById('report-details').value;
            
            if (!reason) {
                showToast('Please select a reason for reporting 😕', 'error');
                return;
            }
            
            const user = await checkAuth();
            if (!user) return;
            
            try {
                const { error } = await supabase
                    .from('reports')
                    .insert([{
                        user_id: user.id,
                        product_id: productId,
                        seller_id: sellerId,
                        reason: reason,
                        details: details
                    }]);
                
                if (error) {
                    console.error('Error submitting report:', error);
                    showToast('Error submitting report 😕', 'error');
                    return;
                }
                
                showToast('Report submitted successfully! 🎉', 'success');
                
                // Close modal
                document.getElementById('report-modal').style.display = 'none';
                
                // Reset form
                this.reset();
            } catch (err) {
                console.error('Unexpected error submitting report:', err);
                showToast('Unexpected error submitting report 😕', 'error');
            }
        });

        // Format post time (e.g., "2 hours ago")
        function formatPostTime(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            
            return date.toLocaleDateString();
        }

        // Change image in gallery
        function changeImage(button, direction) {
            const container = button.parentElement.querySelector('.product-image-container');
            const images = JSON.parse(container.dataset.images);
            let currentIndex = parseInt(container.dataset.current);
            
            currentIndex += direction;
            if (currentIndex < 0) currentIndex = images.length - 1;
            if (currentIndex >= images.length) currentIndex = 0;
            
            container.dataset.current = currentIndex;
            container.style.transform = `translateX(-${currentIndex * 100}%)`;
            
            // Update indicators
            const indicators = button.parentElement.querySelectorAll('.indicator');
            indicators.forEach((ind, idx) => {
                ind.classList.toggle('active', idx === currentIndex);
            });
        }

        // Go to specific image
        function goToImage(indicator, index) {
            const container = indicator.parentElement.parentElement.querySelector('.product-image-container');
            const images = JSON.parse(container.dataset.images);
            
            container.dataset.current = index;
            container.style.transform = `translateX(-${index * 100}%)`;
            
            // Update indicators
            const indicators = indicator.parentElement.querySelectorAll('.indicator');
            indicators.forEach((ind, idx) => {
                ind.classList.toggle('active', idx === index);
            });
        }

        // Image Modal Functions
        let modalImages = [];
        let modalCurrentIndex = 0;

        function openImageModal(images, currentIndex = 0) {
            const modal = document.getElementById('image-modal');
            const modalImage = document.querySelector('.modal-image');
            
            modalImages = images;
            modalCurrentIndex = currentIndex;
            
            modalImage.src = images[currentIndex];
            updateModalIndicators();
            
            modal.style.display = 'block';
        }

        function updateModalIndicators() {
            const indicatorsContainer = document.querySelector('.modal-indicators');
            indicatorsContainer.innerHTML = '';
            
            modalImages.forEach((_, index) => {
                const indicator = document.createElement('div');
                indicator.className = `modal-indicator ${index === modalCurrentIndex ? 'active' : ''}`;
                indicator.addEventListener('click', () => {
                    modalCurrentIndex = index;
                    document.querySelector('.modal-image').src = modalImages[index];
                    updateModalIndicators();
                });
                indicatorsContainer.appendChild(indicator);
            });
        }

        function changeModalImage(direction) {
            modalCurrentIndex += direction;
            if (modalCurrentIndex < 0) modalCurrentIndex = modalImages.length - 1;
            if (modalCurrentIndex >= modalImages.length) modalCurrentIndex = 0;
            
            document.querySelector('.modal-image').src = modalImages[modalCurrentIndex];
            updateModalIndicators();
        }

        // Close modal
        document.querySelector('.close-modal').addEventListener('click', function() {
            document.getElementById('image-modal').style.display = 'none';
        });

        // Modal navigation
        document.querySelector('.modal-nav.prev').addEventListener('click', () => changeModalImage(-1));
        document.querySelector('.modal-nav.next').addEventListener('click', () => changeModalImage(1));

        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            const modal = document.getElementById('image-modal');
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Close report modal
        document.querySelectorAll('.close-modal').forEach(closeBtn => {
            closeBtn.addEventListener('click', function() {
                this.closest('.modal').style.display = 'none';
            });
        });

        document.getElementById('report-cancel')?.addEventListener('click', function() {
            document.getElementById('report-modal').style.display = 'none';
        });

        // Status filter functionality
        document.getElementById('status-filter')?.addEventListener('change', function() {
            loadProducts(this.value);
        });

        // Newsletter form submission
        document.querySelector('.newsletter-form')?.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            showToast(`Thank you for subscribing with ${email}! 🎉`, 'success');
            this.reset();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await supabase.auth.signOut();
            showToast('Logged out successfully 😢');
            setTimeout(() => window.location.href = 'index.html', 1000);
        });

        // Initialize
        checkAuth().then(() => {
            loadProducts();

            // Real-time subscription for updates
            supabase
                .channel('products')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                    console.log('Product change detected');
                    const statusFilter = document.getElementById('status-filter')?.value || 'all';
                    loadProducts(statusFilter);
                })
                .subscribe();
                
            // Real-time subscription for likes
            supabase
                .channel('likes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
                    console.log('Like change detected');
                    const statusFilter = document.getElementById('status-filter')?.value || 'all';
                    loadProducts(statusFilter);
                })
                .subscribe();
                
            // Real-time subscription for comments
            supabase
                .channel('comments')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
                    console.log('Comment change detected');
                    // Reload comments for the specific product
                    const productId = this.new.record.product_id;
                    loadComments(productId);
                })
                .subscribe();
        });
