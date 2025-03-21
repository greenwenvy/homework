  // load marked library for markdown parsing in comment previews
    if (!window.marked) {
        let markedScript = document.createElement('script');
        markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        document.head.appendChild(markedScript);
    }

    // helper: parse markdown text to html if possible
    function parseMarkdown(text) {
        if (window.marked) {
            return window.marked.parse(text);
        }
        return text;
    }

    // function to style text buttons
    function styleTextButton(button, hoverColor) {
        button.style.color = '#888';
        button.style.fontWeight = 'bold';
        button.style.padding = '0 3px';
        button.style.cursor = 'pointer';
        button.addEventListener('mouseenter', () => {
            button.style.color = hoverColor;
        });
        button.addEventListener('mouseleave', () => {
            if (!button.classList.contains('active')) {
                button.style.color = '#888';
            }
        });
    }

    // toggle active state of vote button
    function toggleButtonState(button, hoverColor) {
        if (button.classList.contains('active')) {
            button.classList.remove('active');
            button.style.color = '#888';
        } else {
            button.classList.add('active');
            button.style.color = hoverColor;
        }
    }

    // replace vote buttons with text buttons
    function replaceVoteButtons(post) {
        if (post.dataset.modified) return;
        post.dataset.modified = 'true';

        const upvote = post.querySelector('.arrow.up');
        const downvote = post.querySelector('.arrow.down');
        const buttonContainer = post.querySelector('.flat-list.buttons');
        const expando = post.querySelector('.comment-expando');

        if (upvote && downvote && buttonContainer) {
            const upvoteBtn = document.createElement('a');
            upvoteBtn.href = '#';
            upvoteBtn.textContent = 'upvote';
            styleTextButton(upvoteBtn, '#ff4500');

            const downvoteBtn = document.createElement('a');
            downvoteBtn.href = '#';
            downvoteBtn.textContent = 'downvote';
            styleTextButton(downvoteBtn, '#7193ff');

            upvoteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                upvote.click();
                toggleButtonState(upvoteBtn, '#ff4500');
            });
            downvoteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                downvote.click();
                toggleButtonState(downvoteBtn, '#7193ff');
            });

            if (expando) {
                expando.insertAdjacentElement('afterend', upvoteBtn);
                upvoteBtn.insertAdjacentElement('afterend', downvoteBtn);
            } else {
                buttonContainer.insertBefore(downvoteBtn, buttonContainer.firstChild);
                buttonContainer.insertBefore(upvoteBtn, buttonContainer.firstChild);
            }
        }
    }

    // process posts that already exist
    function processExistingPosts() {
        document.querySelectorAll('.thing').forEach(replaceVoteButtons);
    }
    processExistingPosts();

    // observe new posts being added dynamically
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.classList.contains('thing')) {
                    replaceVoteButtons(node);
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // add expando button for comment preview on posts
    document.querySelectorAll('.thing.link').forEach(post => {
        let commentsAnchor = post.querySelector('a.comments');
        let postUrl = commentsAnchor ? commentsAnchor.href : null;
        if (!postUrl) return;

        let expandoBtn = document.createElement('span');
        expandoBtn.textContent = '[+ preview comments]';
        expandoBtn.className = 'comment-expando';
        expandoBtn.addEventListener('click', function() {
            // toggle comment preview on/off
            let preview = expandoBtn.nextSibling;
            if (preview && preview.classList && preview.classList.contains('comment-preview')) {
                preview.remove();
                expandoBtn.textContent = '[+ preview comments]';
                return;
            }
            loadComments(expandoBtn, postUrl);
        });
        let buttonContainer = post.querySelector('.flat-list.buttons');
        if (buttonContainer) {
            buttonContainer.prepend(expandoBtn);
        }
    });

    // load comments using gm_xmlhttprequest
    function loadComments(expandoBtn, postUrl) {
        let loadingText = document.createElement('div');
        loadingText.className = 'comment-loading';
        loadingText.textContent = 'loading comments...';
        expandoBtn.after(loadingText);

        GM_xmlhttpRequest({
            method: 'GET',
            url: postUrl + '.json',
            onload: function(response) {
                loadingText.remove();
                let data = JSON.parse(response.responseText);
                let comments = data[1].data.children.filter(c => c.kind === "t1").map(c => c.data);

                let previewDiv = document.createElement('div');
                previewDiv.className = 'comment-preview';

                if (comments.length) {
                    let currentCommentIndex = 0;
                    previewDiv.innerHTML = '';
                    previewDiv.appendChild(formatComment(comments[currentCommentIndex], postUrl));

                    let nextBtn = document.createElement('span');
                    nextBtn.textContent = '[next]';
                    nextBtn.className = 'comment-next';
                    nextBtn.addEventListener('click', function() {
                        currentCommentIndex = (currentCommentIndex + 1) % comments.length;
                        previewDiv.innerHTML = '';
                        previewDiv.appendChild(formatComment(comments[currentCommentIndex], postUrl));
                        previewDiv.appendChild(nextBtn);
                    });
                    previewDiv.appendChild(nextBtn);
                } else {
                    previewDiv.innerHTML = '<p>no comments yet.</p>';
                }

                expandoBtn.textContent = '[- hide comments]';
                expandoBtn.after(previewDiv);
            }
        });
    }

    // create a dom element for a comment with extra features and inline replies
    function formatComment(comment, postUrl, depth = 0) {
        const container = document.createElement('div');
        container.className = 'comment-preview-item';
        container.style.marginBottom = '10px';
        container.style.padding = '5px';
        container.style.borderBottom = '1px dashed #ccc';

        // comment main content
        const contentP = document.createElement('p');
        contentP.style.margin = '0';
        const authorLink = document.createElement('a');
        authorLink.href = postUrl + comment.id;
        authorLink.target = '_blank';
        authorLink.className = 'comment-author';
        authorLink.style.fontWeight = 'bold';
        authorLink.textContent = comment.author;
        contentP.appendChild(authorLink);

        // add colon and markdown-parsed comment body
        const colonText = document.createTextNode(': ');
        contentP.appendChild(colonText);
        const commentTextDiv = document.createElement('div');
        commentTextDiv.innerHTML = parseMarkdown(comment.body);
        contentP.appendChild(commentTextDiv);

        // NOTE: Removed score span from content paragraph
        container.appendChild(contentP);

        // comment metadata (timestamp, edited, replies count)
        const metaP = document.createElement('p');
        metaP.style.margin = '0';
        metaP.style.fontSize = '10px';
        metaP.style.color = '#555';

        // Create score span
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'comment-score';
        scoreSpan.style.color = '#888';
        scoreSpan.textContent = `(${addCommas(comment.score)})`;

        const createdTime = new Date(comment.created_utc * 1000).toLocaleString();
        let metaText = createdTime;
        if (comment.edited && comment.edited !== false) {
            metaText += " (edited)";
        }
        let repliesCount = 0;
        if (comment.replies && comment.replies.data && comment.replies.data.children) {
            repliesCount = comment.replies.data.children.filter(child => child.kind === "t1").length;
        }
        if (repliesCount > 0 && depth === 0) {
            metaText += ` - ${repliesCount} repl${repliesCount === 1 ? 'y' : 'ies'}`;
        }

        // Add score span to metadata and then the text
        metaP.appendChild(scoreSpan);
        metaP.appendChild(document.createTextNode(' ' + metaText));
        container.appendChild(metaP);

        // if comment has image url in body, show preview
        let urlRegex = /(https?:\/\/\S+\.(jpg|jpeg|png|gif))/i;
        let match = comment.body.match(urlRegex);
        if (match) {
            const img = document.createElement('img');
            img.src = match[1];
            img.alt = "image";
            img.style.maxWidth = "200px";
            img.style.maxHeight = "200px";
            img.style.marginTop = "5px";
            img.style.border = "1px solid #ccc";
            container.appendChild(img);
        }

        // add inline "load replies" if available and if at top level (depth 0)
        if (depth === 0 && comment.replies && comment.replies.data && comment.replies.data.children.length > 0) {
            const loadRepliesBtn = document.createElement('span');
            loadRepliesBtn.textContent = ' [load replies]';
            loadRepliesBtn.style.fontSize = '10px';
            loadRepliesBtn.style.color = '#0079d3';
            loadRepliesBtn.style.cursor = 'pointer';
            loadRepliesBtn.addEventListener('click', function() {
                let existing = container.querySelector('.comment-replies');
                if (existing) {
                    existing.remove();
                    loadRepliesBtn.textContent = ' [load replies]';
                } else {
                    const repliesContainer = formatReplies(comment.replies.data.children, depth + 1);
                    container.appendChild(repliesContainer);
                    loadRepliesBtn.textContent = ' [hide replies]';
                }
            });
            container.appendChild(loadRepliesBtn);
        }

        // add upvote/downvote buttons for comment preview
        const voteContainer = document.createElement('div');
        voteContainer.style.marginTop = '5px';

        const upvoteLink = document.createElement('a');
        // append parameters so that the new tab knows to auto-vote
        upvoteLink.href = `${postUrl}${comment.id}?vote=up&cid=${comment.id}`;
        upvoteLink.textContent = 'upvote';
        upvoteLink.style.fontSize = '10px';
        upvoteLink.style.color = '#ff4500';
        upvoteLink.style.marginRight = '5px';
        upvoteLink.target = '_blank';

        const downvoteLink = document.createElement('a');
        downvoteLink.href = `${postUrl}${comment.id}?vote=down&cid=${comment.id}`;
        downvoteLink.textContent = 'downvote';
        downvoteLink.style.fontSize = '10px';
        downvoteLink.style.color = '#7193ff';
        downvoteLink.target = '_blank';

        voteContainer.appendChild(upvoteLink);
        voteContainer.appendChild(downvoteLink);
        container.appendChild(voteContainer);

        return container;
    }

    // new version of formatReplies with "load more replies" functionality
    function formatReplies(replies, depth) {
        const container = document.createElement('div');
        container.className = 'comment-replies';
        container.style.marginLeft = '20px';
        container.style.borderLeft = '1px dashed #ccc';
        container.style.paddingLeft = '5px';

        let repliesPerPage = 3;
        let currentIndex = 0;

        function loadNextReplies() {
            let loadedCount = 0;
            let existingBtn = container.querySelector('.load-more-btn');
            if (existingBtn) existingBtn.remove();

            while (currentIndex < replies.length && loadedCount < repliesPerPage) {
                const reply = replies[currentIndex];
                currentIndex++;
                if (reply.kind !== 't1') continue;
                const replyElem = formatComment(reply.data, "", depth);
                container.appendChild(replyElem);
                loadedCount++;
            }
            if (currentIndex < replies.length) {
                const loadMoreBtn = document.createElement('span');
                loadMoreBtn.textContent = ' [load more replies]';
                loadMoreBtn.className = 'load-more-btn';
                loadMoreBtn.style.fontSize = '10px';
                loadMoreBtn.style.color = '#0079d3';
                loadMoreBtn.style.cursor = 'pointer';
                loadMoreBtn.addEventListener('click', function() {
                    loadNextReplies();
                });
                container.appendChild(loadMoreBtn);
            }
        }

        loadNextReplies();
        return container;
    }

    // utility: add commas to numbers
    function addCommas(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // estimate vote breakdown and display upvote/downvote/totals
    function estimatePostScoreVotes() {
        document.querySelectorAll('.linkinfo .score').forEach(linkinfoScore => {
            const numberElement = linkinfoScore.querySelector('.number');
            if (!numberElement) return;
            const points = parseInt(numberElement.textContent.replace(/[^0-9]/g, ''), 10);
            const percentageMatch = linkinfoScore.textContent.match(/([0-9]{1,3})\s?%/);
            const percentage = percentageMatch ? parseInt(percentageMatch[1], 10) : 0;
            if (points !== 50 && percentage !== 50) {
                const upvotes = Math.round(points * percentage / (2 * percentage - 100));
                const downvotes = upvotes - points;
                const totalVotes = upvotes + downvotes;
                const css = `
                    .linkinfo .upvotes { font-size: 80%; color: orangered; margin-left: 5px; }
                    .linkinfo .downvotes { font-size: 80%; color: #5f99cf; margin-left: 5px; }
                    .linkinfo .totalvotes { font-size: 80%; margin-left: 5px; }
                `;
                const style = document.createElement('style');
                style.innerHTML = css;
                document.head.appendChild(style);
                linkinfoScore.insertAdjacentHTML('afterend', `
                    <span class="upvotes"><span class="number">${addCommas(upvotes)}</span> <span class="word">${upvotes > 1 ? 'upvotes' : 'upvote'}</span></span>
                    <span class="downvotes"><span class="number">${addCommas(downvotes)}</span> <span class="word">${downvotes > 1 ? 'downvotes' : 'downvote'}</span></span>
                    <span class="totalvotes"><span class="number">${addCommas(totalVotes)}</span> <span class="word">${totalVotes > 1 ? 'votes' : 'vote'}</span></span>
                `);
            }
        });
    }

    // add detailed upvote/downvote info to post taglines
    async function addUpvoteDownvoteInfo() {
        const linkListing = document.querySelector(".linklisting") || (document.querySelector(".Post") ? document.querySelector(".Post").parentElement : null);
        if (!linkListing) return;
        const linkDivs = linkListing.getElementsByClassName("link");
        const promises = Array.from(linkDivs).map(async (linkDiv) => {
            const commentsLink = linkDiv.querySelector(".comments");
            if (!commentsLink) return;
            const commentsPage = await httpGet(`${commentsLink.href}?limit=1&depth=1`);
            const scoreSection = /<div class=(["'])score\1[\s\S]*?<\/div>/.exec(commentsPage);
            if (!scoreSection) return;
            const scoreMatch = /<span class=(["'])number\1>([\d\,\.]*)<\/span>/.exec(scoreSection[0]);
            if (!scoreMatch) return;
            const score = parseInt(scoreMatch[2].replace(/[,\.]/g, ''), 10);
            const upvotesPercentageMatch = /\((\d+)\s*%[^\)]*\)/.exec(scoreSection[0]);
            if (!upvotesPercentageMatch) return;
            const upvotesPercentage = parseInt(upvotesPercentageMatch[1], 10);
            const upvotes = calcUpvotes(score, upvotesPercentage);
            const downvotes = upvotes !== "--" ? score - upvotes : "--";
            updateTagline(linkDiv, upvotes, downvotes, upvotesPercentage);
        });
        await Promise.all(promises);
    }
